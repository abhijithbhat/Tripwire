import { addDays, compareISODate } from '../shared/dates';
import { PlanSchema, type CostRule, type Plan, type Vendor } from './schema';

/** An issue found during schema or semantic validation of a plan. */
export interface ValidationIssue {
  /** Dot-joined path with numeric indexes, e.g. vendors.1.costRules.2.pctBp */
  path: string;
  /** Issue code, e.g. 'SCHEMA' or a semantic code like 'DUPLICATE_VENDOR_ID' */
  code: string;
  /** Human-readable explanation of the issue */
  message: string;
}

/** Result of plan validation: either success with parsed Plan or failure with issues list. */
export type ValidationResult = { ok: true; plan: Plan } | { ok: false; issues: ValidationIssue[] };

function checkRules(
  rules: readonly CostRule[],
  basePath: string,
  label: string,
  issues: ValidationIssue[],
): void {
  const seenRuleIds = new Set<string>();
  let seenSurcharge = false;

  for (let r = 0; r < rules.length; r++) {
    const rule = rules[r]!;
    if (seenRuleIds.has(rule.id)) {
      issues.push({
        path: `${basePath}.${r}.id`,
        code: 'DUPLICATE_RULE_ID',
        message: `Duplicate rule id "${rule.id}" in ${label}`,
      });
    } else {
      seenRuleIds.add(rule.id);
    }

    if (rule.kind === 'PER_GUEST_TIERED') {
      const tiers = rule.tiers;
      let valid = tiers[0]?.fromGuests === 0;
      if (valid) {
        for (let t = 1; t < tiers.length; t++) {
          if (tiers[t]!.fromGuests <= tiers[t - 1]!.fromGuests) {
            valid = false;
            break;
          }
        }
      }
      if (!valid) {
        issues.push({
          path: `${basePath}.${r}.tiers`,
          code: 'TIER_ORDER',
          message: 'PER_GUEST_TIERED tiers must start at fromGuests: 0 and be strictly ascending',
        });
      }
    }

    if (rule.kind === 'SURCHARGE_PCT') {
      seenSurcharge = true;
    } else if (seenSurcharge) {
      issues.push({
        path: `${basePath}.${r}`,
        code: 'SURCHARGE_ORDER',
        message: `Rule "${rule.id}" cannot follow a SURCHARGE_PCT rule`,
      });
    }
  }
}

function checkVendorCancellation(vendor: Vendor, i: number, issues: ValidationIssue[]): void {
  let hasZeroTier = false;
  const seenDays = new Set<number>();

  for (let c = 0; c < vendor.cancellation.length; c++) {
    const tier = vendor.cancellation[c]!;
    if (tier.minDaysBefore === 0) hasZeroTier = true;

    if (seenDays.has(tier.minDaysBefore)) {
      issues.push({
        path: `vendors.${i}.cancellation.${c}.minDaysBefore`,
        code: 'CANCELLATION_DUPLICATE_TIER',
        message: `Duplicate cancellation tier: ${tier.minDaysBefore}`,
      });
    } else {
      seenDays.add(tier.minDaysBefore);
    }

    if (tier.forfeitPctBp > 10_000) {
      issues.push({
        path: `vendors.${i}.cancellation.${c}.forfeitPctBp`,
        code: 'CANCELLATION_PCT_RANGE',
        message: `forfeitPctBp must be <= 10000, got ${tier.forfeitPctBp}`,
      });
    }
  }

  if (!hasZeroTier) {
    issues.push({
      path: `vendors.${i}.cancellation`,
      code: 'CANCELLATION_NO_ZERO_TIER',
      message: `Vendor "${vendor.id}" cancellation must include tier with minDaysBefore: 0`,
    });
  }
}

function checkVendor(vendor: Vendor, i: number, plan: Plan, issues: ValidationIssue[]): void {
  checkRules(vendor.costRules, `vendors.${i}.costRules`, `vendor "${vendor.id}"`, issues);

  const seenMilestoneIds = new Set<string>();
  let pctSum = 0;
  for (let m = 0; m < vendor.paymentSchedule.length; m++) {
    const ms = vendor.paymentSchedule[m]!;
    pctSum += ms.pctBp;
    if (seenMilestoneIds.has(ms.id)) {
      issues.push({
        path: `vendors.${i}.paymentSchedule.${m}.id`,
        code: 'DUPLICATE_MILESTONE_ID',
        message: `Duplicate milestone id "${ms.id}" in vendor "${vendor.id}"`,
      });
    } else {
      seenMilestoneIds.add(ms.id);
    }
  }
  if (pctSum !== 10_000) {
    issues.push({
      path: `vendors.${i}.paymentSchedule`,
      code: 'PAYMENT_PCT_SUM',
      message: `Milestone pctBp for vendor "${vendor.id}" must sum to 10000, got ${pctSum}`,
    });
  }

  checkVendorCancellation(vendor, i, issues);

  const seenOptionIds = new Set<string>();
  for (let o = 0; o < vendor.options.length; o++) {
    const opt = vendor.options[o]!;
    if (seenOptionIds.has(opt.id)) {
      issues.push({
        path: `vendors.${i}.options.${o}.id`,
        code: 'DUPLICATE_OPTION_ID',
        message: `Duplicate option id "${opt.id}" in vendor "${vendor.id}"`,
      });
    } else {
      seenOptionIds.add(opt.id);
    }
    checkRules(opt.costRules, `vendors.${i}.options.${o}.costRules`, `option "${opt.id}"`, issues);
  }

  if (vendor.lock) {
    if (
      vendor.lock.increaseAllowedUntilOffsetDays !== undefined &&
      vendor.lock.increaseAllowedUntilOffsetDays > vendor.lock.lockOffsetDays
    ) {
      issues.push({
        path: `vendors.${i}.lock.increaseAllowedUntilOffsetDays`,
        code: 'LOCK_WINDOW',
        message: `increaseAllowedUntilOffsetDays must be <= lockOffsetDays`,
      });
    }
    if (vendor.lock.guaranteedGuests === undefined) {
      try {
        const deadline = addDays(plan.eventDate, -vendor.lock.lockOffsetDays);
        if (compareISODate(plan.asOfDate, deadline) >= 0) {
          issues.push({
            path: `vendors.${i}.lock.guaranteedGuests`,
            code: 'LOCK_GUARANTEE_REQUIRED',
            message: `guaranteedGuests required when asOfDate is at or past lock deadline`,
          });
        }
      } catch {
        // Defensive
      }
    }
  }

  if (vendor.capacity !== undefined && vendor.category !== 'VENUE') {
    issues.push({
      path: `vendors.${i}.capacity`,
      code: 'CAPACITY_NON_VENUE',
      message: `capacity set on vendor "${vendor.id}" whose category is "${vendor.category}"`,
    });
  }
}

/**
 * Validates a plan against the structural Zod schema and all domain semantic constraints.
 * Never throws and never mutates input.
 *
 * @param input Raw plan data.
 * @returns ValidationResult with typed Plan or all detected issues.
 */
export function validatePlan(input: unknown): ValidationResult {
  const parseResult = PlanSchema.safeParse(input);
  if (!parseResult.success) {
    const issues: ValidationIssue[] = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: 'SCHEMA',
      message: issue.message,
    }));
    return { ok: false, issues };
  }

  const plan = parseResult.data;
  const issues: ValidationIssue[] = [];

  try {
    if (compareISODate(plan.asOfDate, plan.eventDate) > 0) {
      issues.push({
        path: 'asOfDate',
        code: 'AS_OF_AFTER_EVENT',
        message: `asOfDate (${plan.asOfDate}) cannot be after eventDate (${plan.eventDate})`,
      });
    }
  } catch {
    // Defensive
  }

  if (plan.budgetCap <= 0) {
    issues.push({
      path: 'budgetCap',
      code: 'BUDGET_ZERO',
      message: `budgetCap must be > 0, got ${plan.budgetCap}`,
    });
  }

  const seenVendorIds = new Set<string>();
  for (let i = 0; i < plan.vendors.length; i++) {
    const vendor = plan.vendors[i]!;
    if (seenVendorIds.has(vendor.id)) {
      issues.push({
        path: `vendors.${i}.id`,
        code: 'DUPLICATE_VENDOR_ID',
        message: `Duplicate vendor id "${vendor.id}"`,
      });
    } else {
      seenVendorIds.add(vendor.id);
    }
    checkVendor(vendor, i, plan, issues);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, plan };
}
