import { applyChanges } from '../change/apply';
import type { Change } from '../change/schema';
import type { Plan } from '../domain/schema';
import { evaluatePlan, summarizeTripwires } from '../evaluate/evaluate';
import type { Evaluation, Tripwire } from '../evaluate/types';
import { evaluateChangeAware } from './change-aware';
import { diffPayments, diffTripwires, diffVendorCosts, escalationsOf } from './diff';
import type { AssessResult } from './types';

/**
 * Assesses the impact of applying a series of changes to a plan.
 *
 * Pure function: applies changes, evaluates before and after plans,
 * derives change-aware tripwires, and computes deltas for costs,
 * payments, and tripwires.
 *
 * @param plan The initial plan state.
 * @param changes List of changes to apply.
 * @returns AssessResult containing the ChangeImpact or an ApplyError.
 */
export function assessChange(plan: Plan, changes: readonly Change[]): AssessResult {
  const applied = applyChanges(plan, changes);
  if (!applied.ok) {
    return { ok: false, error: applied.error };
  }

  const before = evaluatePlan(plan);
  const afterBase = evaluatePlan(applied.plan);

  const extra = evaluateChangeAware(plan, applied.plan, before, afterBase);
  const tripwires: Tripwire[] = [...afterBase.tripwires, ...extra];
  const after: Evaluation = {
    ...afterBase,
    tripwires,
    ...summarizeTripwires(tripwires),
  };

  const planCostDelta = after.cost.total - before.cost.total;
  const headroomDelta =
    applied.plan.budgetCap - after.cost.total - (plan.budgetCap - before.cost.total);

  const tripwireDeltas = diffTripwires(before.tripwires, after.tripwires);
  const escalations = escalationsOf(after.tripwires, tripwireDeltas);
  const vendorCostDeltas = diffVendorCosts(plan, applied.plan, before, after);
  const paymentChanges = diffPayments(before, after);

  return {
    ok: true,
    impact: {
      changes,
      assumptions: applied.assumptions,
      before,
      after,
      planCostDelta,
      headroomDelta,
      vendorCostDeltas,
      tripwireDeltas,
      escalations,
      paymentChanges,
    },
  };
}
