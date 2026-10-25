import type { CostRule, Plan } from '../domain/schema';
import { validatePlan } from '../domain/validate';
import { addDays, compareISODate } from '../shared/dates';
import { mulBp } from '../shared/money';
import type { Change } from './schema';

export type ApplyErrorCode =
  | 'NEGATIVE_GUESTS'
  | 'INVALID_BUDGET'
  | 'DATE_BEFORE_AS_OF'
  | 'VENDOR_NOT_FOUND'
  | 'VENDOR_NOT_ACTIVE'
  | 'INVALID_RESULT';

export interface ApplyError {
  code: ApplyErrorCode;
  message: string;
  changeIndex?: number;
}

export interface Assumption {
  code: 'GUARANTEE_ASSUMED';
  vendorId: string;
  guests: number;
}

export type ApplyResult =
  { ok: true; plan: Plan; assumptions: Assumption[] } | { ok: false; error: ApplyError };

function updateCostRulePrice(rule: CostRule, factor: number): CostRule {
  switch (rule.kind) {
    case 'FLAT':
      return { ...rule, amount: mulBp(rule.amount, factor) };
    case 'PER_GUEST':
      return { ...rule, unitAmount: mulBp(rule.unitAmount, factor) };
    case 'PER_GUEST_TIERED':
      return {
        ...rule,
        tiers: rule.tiers.map((tier) => ({
          ...tier,
          unitAmount: mulBp(tier.unitAmount, factor),
        })),
      };
    case 'STEP':
      return { ...rule, unitAmount: mulBp(rule.unitAmount, factor) };
    case 'SURCHARGE_PCT':
      return rule;
  }
}

function validateVendorActive(plan: Plan, vendorId: string): ApplyError | undefined {
  const vendor = plan.vendors.find((v) => v.id === vendorId);
  if (!vendor) {
    return { code: 'VENDOR_NOT_FOUND', message: `Vendor "${vendorId}" not found` };
  }
  if (vendor.status !== 'CONFIRMED') {
    return {
      code: 'VENDOR_NOT_ACTIVE',
      message: `Vendor "${vendorId}" is not active (status: ${vendor.status})`,
    };
  }
  return undefined;
}

/**
 * Purely applies a single Change to a Plan, returning a new Plan or an ApplyError.
 * Never mutates inputs. Validates the resulting plan with validatePlan.
 *
 * @param plan Starting plan.
 * @param change Change specification to apply.
 * @returns Result with updated plan and assumptions or error.
 */
export function applyChange(plan: Plan, change: Change): ApplyResult {
  let nextPlan: Plan;
  const assumptions: Assumption[] = [];

  switch (change.kind) {
    case 'GUEST_COUNT_SET':
      nextPlan = { ...plan, guestCount: change.to };
      break;

    case 'GUEST_COUNT_DELTA': {
      const nextGuests = plan.guestCount + change.delta;
      if (nextGuests < 0) {
        return {
          ok: false,
          error: {
            code: 'NEGATIVE_GUESTS',
            message: `Guest count cannot be negative: ${nextGuests}`,
          },
        };
      }
      nextPlan = { ...plan, guestCount: nextGuests };
      break;
    }

    case 'BUDGET_CAP_SET':
      nextPlan = { ...plan, budgetCap: change.to };
      break;

    case 'BUDGET_CAP_PCT': {
      const factor = 10_000 + change.pctBp;
      const nextBudget = mulBp(plan.budgetCap, factor);
      if (nextBudget < 1) {
        return {
          ok: false,
          error: {
            code: 'INVALID_BUDGET',
            message: `Budget cap must be at least 1: ${nextBudget}`,
          },
        };
      }
      nextPlan = { ...plan, budgetCap: nextBudget };
      break;
    }

    case 'EVENT_DATE_MOVE': {
      if (compareISODate(change.to, plan.asOfDate) < 0) {
        return {
          ok: false,
          error: {
            code: 'DATE_BEFORE_AS_OF',
            message: `Event date (${change.to}) cannot be before asOfDate (${plan.asOfDate})`,
          },
        };
      }
      const vendors = plan.vendors.map((vendor) => {
        if (!vendor.lock) return vendor;
        const deadline = addDays(change.to, -vendor.lock.lockOffsetDays);
        if (
          compareISODate(deadline, plan.asOfDate) <= 0 &&
          vendor.lock.guaranteedGuests === undefined
        ) {
          assumptions.push({
            code: 'GUARANTEE_ASSUMED',
            vendorId: vendor.id,
            guests: plan.guestCount,
          });
          return {
            ...vendor,
            lock: { ...vendor.lock, guaranteedGuests: plan.guestCount },
          };
        }
        return vendor;
      });
      nextPlan = { ...plan, eventDate: change.to, vendors };
      break;
    }

    case 'VENDOR_DROP': {
      const err = validateVendorActive(plan, change.vendorId);
      if (err) return { ok: false, error: err };
      const vendors = plan.vendors.map((v) =>
        v.id === change.vendorId ? { ...v, status: 'DROPPED' as const } : v,
      );
      nextPlan = { ...plan, vendors };
      break;
    }

    case 'VENDOR_PRICE_PCT': {
      const err = validateVendorActive(plan, change.vendorId);
      if (err) return { ok: false, error: err };
      const factor = 10_000 + change.pctBp;
      const vendors = plan.vendors.map((v) => {
        if (v.id !== change.vendorId) return v;
        const costRules = v.costRules.map((r) => updateCostRulePrice(r, factor));
        return { ...v, costRules };
      });
      nextPlan = { ...plan, vendors };
      break;
    }
  }

  const validation = validatePlan(nextPlan);
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code: 'INVALID_RESULT',
        message: validation.issues.map((i) => i.code).join(', '),
      },
    };
  }

  return {
    ok: true,
    plan: validation.plan,
    assumptions,
  };
}

/**
 * Sequentially applies a list of Changes to a Plan.
 * Stops at the first error and returns it with changeIndex set.
 * Assumptions accumulate across all successfully applied changes.
 *
 * @param plan Starting plan.
 * @param changes Changes to apply in order.
 * @returns Result with final plan and accumulated assumptions or error.
 */
export function applyChanges(plan: Plan, changes: readonly Change[]): ApplyResult {
  let currentPlan = plan;
  const assumptions: Assumption[] = [];

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]!;
    const result = applyChange(currentPlan, change);
    if (!result.ok) {
      return {
        ok: false,
        error: {
          ...result.error,
          changeIndex: i,
        },
      };
    }
    currentPlan = result.plan;
    assumptions.push(...result.assumptions);
  }

  return {
    ok: true,
    plan: currentPlan,
    assumptions,
  };
}
