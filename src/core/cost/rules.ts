import type { CostRule } from '../domain/schema';
import { ceilDiv, mulBp, type Money } from '../shared/money';

/**
 * A computed line item resulting from evaluating a CostRule.
 */
export interface CostLine {
  ruleId: string;
  label: string;
  kind: CostRule['kind'];
  amount: Money;
}

/**
 * Total cost breakdown of a collection of evaluated CostRules.
 */
export interface RulesCost {
  lines: CostLine[];
  baseSubtotal: Money;
  total: Money;
}

/**
 * Computes cost lines and total for a list of CostRules.
 * Base rules are evaluated first in array order, followed by percentage surcharges.
 *
 * @param rules Array of cost rules to evaluate.
 * @param guests Object containing attending and billable guest counts.
 * @returns Evaluated CostLines, baseSubtotal, and final total.
 */
export function computeRulesCost(
  rules: readonly CostRule[],
  guests: { attending: number; billable: number },
): RulesCost {
  const lines: CostLine[] = [];
  let baseSubtotal = 0;

  // Pass 1: Evaluate base (non-surcharge) rules in order
  for (const rule of rules) {
    if (rule.kind === 'SURCHARGE_PCT') {
      continue;
    }

    let lineAmount: Money;
    switch (rule.kind) {
      case 'FLAT':
        lineAmount = rule.amount;
        break;

      case 'PER_GUEST': {
        const billable = Math.max(guests.billable, rule.minBillableGuests ?? 0);
        lineAmount = rule.unitAmount * billable;
        break;
      }

      case 'PER_GUEST_TIERED': {
        const billable = Math.max(guests.billable, rule.minBillableGuests ?? 0);
        let activeBand = rule.tiers[0]!;
        for (let i = 1; i < rule.tiers.length; i++) {
          const band = rule.tiers[i]!;
          if (band.fromGuests <= billable) {
            activeBand = band;
          } else {
            break;
          }
        }
        lineAmount = activeBand.unitAmount * billable;
        break;
      }

      case 'STEP': {
        const units = ceilDiv(guests.attending, rule.guestsPerUnit);
        lineAmount = units * rule.unitAmount;
        break;
      }
    }

    lines.push({
      ruleId: rule.id,
      label: rule.label,
      kind: rule.kind,
      amount: lineAmount,
    });
    baseSubtotal += lineAmount;
  }

  // Pass 2: Evaluate surcharges in order
  let accumulatedSurcharges = 0;
  for (const rule of rules) {
    if (rule.kind !== 'SURCHARGE_PCT') {
      continue;
    }

    const basis = rule.base === 'BASE_ONLY' ? baseSubtotal : baseSubtotal + accumulatedSurcharges;

    const surchargeAmount = mulBp(basis, rule.pctBp);
    accumulatedSurcharges += surchargeAmount;

    lines.push({
      ruleId: rule.id,
      label: rule.label,
      kind: 'SURCHARGE_PCT',
      amount: surchargeAmount,
    });
  }

  const total = baseSubtotal + accumulatedSurcharges;
  return { lines, baseSubtotal, total };
}
