import { computePaymentTimeline } from '../cost/payments';
import { computePlanCost } from '../cost/plan-cost';
import type { Plan } from '../domain/schema';
import {
  evaluateBudgetCap,
  evaluateGuestLocks,
  evaluatePayments,
  evaluateVenueCapacity,
  evaluateVenuePresent,
} from './tripwires';
import { STATUS_SEVERITY, type Evaluation, type Tripwire, type TripwireStatus } from './types';

/**
 * Determines the worst (highest severity) TripwireStatus among a list of Tripwires.
 * Returns 'OK' if the list is empty.
 *
 * @param tripwires List of tripwires.
 * @returns Highest severity TripwireStatus.
 */
export function worstStatus(tripwires: readonly Tripwire[]): TripwireStatus {
  let worst: TripwireStatus = 'OK';
  let maxSeverity = 0;

  for (const tw of tripwires) {
    const sev = STATUS_SEVERITY[tw.status];
    if (sev > maxSeverity) {
      maxSeverity = sev;
      worst = tw.status;
    }
  }

  return worst;
}

/**
 * Evaluates all state-based tripwires for a plan.
 * Pure function: never mutates input, never reads the clock, deterministic.
 *
 * Order of emitted tripwires:
 * 1. BUDGET_CAP
 * 2. VENUE_PRESENT (if applicable)
 * 3. VENUE_CAPACITY (in vendor order)
 * 4. GUEST_LOCK (in vendor order)
 * 5. PAYMENT (in timeline order)
 *
 * @param plan Valid plan to evaluate.
 * @returns Evaluation with cost, timeline, ordered tripwires, status counts, and worst status.
 */
export function evaluatePlan(plan: Plan): Evaluation {
  const cost = computePlanCost(plan);
  const timeline = computePaymentTimeline(plan);

  const budgetTw = evaluateBudgetCap(plan, cost);
  const venuePresentTw = evaluateVenuePresent(plan);
  const capacityTws = evaluateVenueCapacity(plan);
  const lockTws = evaluateGuestLocks(plan);
  const paymentTws = evaluatePayments(plan, timeline);

  const tripwires: Tripwire[] = [
    budgetTw,
    ...(venuePresentTw ? [venuePresentTw] : []),
    ...capacityTws,
    ...lockTws,
    ...paymentTws,
  ];

  const counts: Record<TripwireStatus, number> = {
    OK: 0,
    AT_RISK: 0,
    NEEDS_VENDOR: 0,
    TRIPPED: 0,
  };

  for (const tw of tripwires) {
    counts[tw.status]++;
  }

  const worst = worstStatus(tripwires);

  return {
    asOfDate: plan.asOfDate,
    cost,
    timeline,
    tripwires,
    worst,
    counts,
  };
}
