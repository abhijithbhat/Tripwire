import type { Plan } from '../domain/schema';
import { STATUS_SEVERITY, type Evaluation, type Tripwire } from '../evaluate/types';
import type { PaymentChange, TripwireDelta, VendorCostDelta } from './types';

/**
 * Computes the delta of tripwires between before and after evaluations.
 *
 * Output order: every tripwire in `after` in order (NEW if absent in before;
 * otherwise WORSENED / IMPROVED / UNCHANGED by comparing STATUS_SEVERITY),
 * then ids found only in `before` in before order as REMOVED.
 *
 * @param before Tripwires from before evaluation.
 * @param after Tripwires from after evaluation.
 * @returns Array of TripwireDelta objects.
 */
export function diffTripwires(
  before: readonly Tripwire[],
  after: readonly Tripwire[],
): TripwireDelta[] {
  const beforeMap = new Map<string, Tripwire>(before.map((tw) => [tw.id, tw]));
  const afterMap = new Map<string, Tripwire>(after.map((tw) => [tw.id, tw]));

  const deltas: TripwireDelta[] = [];

  for (const tw of after) {
    const beforeTw = beforeMap.get(tw.id);
    if (!beforeTw) {
      deltas.push({
        id: tw.id,
        kind: tw.kind,
        ...(tw.vendorId !== undefined ? { vendorId: tw.vendorId } : {}),
        change: 'NEW',
        after: tw.status,
      });
    } else {
      const beforeSev = STATUS_SEVERITY[beforeTw.status];
      const afterSev = STATUS_SEVERITY[tw.status];
      let change: TripwireDelta['change'];
      if (afterSev > beforeSev) {
        change = 'WORSENED';
      } else if (afterSev < beforeSev) {
        change = 'IMPROVED';
      } else {
        change = 'UNCHANGED';
      }

      deltas.push({
        id: tw.id,
        kind: tw.kind,
        ...(tw.vendorId !== undefined ? { vendorId: tw.vendorId } : {}),
        change,
        before: beforeTw.status,
        after: tw.status,
      });
    }
  }

  for (const beforeTw of before) {
    if (!afterMap.has(beforeTw.id)) {
      deltas.push({
        id: beforeTw.id,
        kind: beforeTw.kind,
        ...(beforeTw.vendorId !== undefined ? { vendorId: beforeTw.vendorId } : {}),
        change: 'REMOVED',
        before: beforeTw.status,
      });
    }
  }

  return deltas;
}

/**
 * Selects tripwires from after that represent new or worsened issues (not OK).
 *
 * @param after Tripwires from after evaluation.
 * @param deltas Computed tripwire deltas.
 * @returns Array of escalating Tripwires in after order.
 */
export function escalationsOf(
  after: readonly Tripwire[],
  deltas: readonly TripwireDelta[],
): Tripwire[] {
  const deltaMap = new Map<string, TripwireDelta['change']>(deltas.map((d) => [d.id, d.change]));

  return after.filter((tw) => {
    const change = deltaMap.get(tw.id);
    return (change === 'NEW' || change === 'WORSENED') && tw.status !== 'OK';
  });
}

/**
 * Computes cost differences per vendor between before and after plans.
 *
 * One entry per vendor (in beforeEval.cost.vendors order) whose total differs.
 *
 * @param beforePlan Plan before changes.
 * @param afterPlan Plan after changes.
 * @param beforeEval Evaluation before changes.
 * @param afterEval Evaluation after changes.
 * @returns Array of VendorCostDelta for affected vendors.
 */
export function diffVendorCosts(
  _beforePlan: Plan,
  afterPlan: Plan,
  beforeEval: Evaluation,
  afterEval: Evaluation,
): VendorCostDelta[] {
  const afterCostMap = new Map<string, number>(
    afterEval.cost.vendors.map((v) => [v.vendorId, v.total]),
  );
  const afterPlanVendorMap = new Map<string, (typeof afterPlan.vendors)[number]>(
    afterPlan.vendors.map((v) => [v.id, v]),
  );

  const deltas: VendorCostDelta[] = [];

  for (const beforeVendorCost of beforeEval.cost.vendors) {
    const vendorId = beforeVendorCost.vendorId;
    const beforeTotal = beforeVendorCost.total;
    const afterTotal = afterCostMap.get(vendorId) ?? 0;

    if (beforeTotal === afterTotal) {
      continue;
    }

    const delta = afterTotal - beforeTotal;
    const afterVendor = afterPlanVendorMap.get(vendorId);
    const dropped = afterVendor?.status === 'DROPPED';

    let paidToDate = 0;
    for (const event of beforeEval.timeline.events) {
      if (event.vendorId === vendorId && event.paid) {
        paidToDate += event.amount;
      }
    }

    let remainingAfter: number;
    let trueUp: number;

    if (dropped) {
      remainingAfter = 0;
      trueUp = 0;
    } else {
      remainingAfter = afterTotal - paidToDate;
      let unpaidAfter = 0;
      for (const event of afterEval.timeline.events) {
        if (event.vendorId === vendorId && !event.paid) {
          unpaidAfter += event.amount;
        }
      }
      trueUp = remainingAfter - unpaidAfter;
    }

    deltas.push({
      vendorId,
      before: beforeTotal,
      after: afterTotal,
      delta,
      dropped,
      paidToDate,
      remainingAfter,
      trueUp,
    });
  }

  return deltas;
}

/**
 * Detects milestone payment changes for unpaid events between before and after evaluations.
 *
 * @param beforeEval Evaluation before changes.
 * @param afterEval Evaluation after changes.
 * @returns Array of PaymentChange in afterEval timeline order.
 */
export function diffPayments(beforeEval: Evaluation, afterEval: Evaluation): PaymentChange[] {
  const beforeEventMap = new Map<string, (typeof beforeEval.timeline.events)[number]>();
  for (const event of beforeEval.timeline.events) {
    if (!event.paid) {
      beforeEventMap.set(`${event.vendorId}:${event.milestoneId}`, event);
    }
  }

  const changes: PaymentChange[] = [];

  for (const afterEvent of afterEval.timeline.events) {
    if (afterEvent.paid) {
      continue;
    }
    const key = `${afterEvent.vendorId}:${afterEvent.milestoneId}`;
    const beforeEvent = beforeEventMap.get(key);
    if (!beforeEvent) {
      continue;
    }

    if (beforeEvent.dueDate !== afterEvent.dueDate || beforeEvent.amount !== afterEvent.amount) {
      changes.push({
        vendorId: afterEvent.vendorId,
        milestoneId: afterEvent.milestoneId,
        label: afterEvent.label,
        fromDate: beforeEvent.dueDate,
        toDate: afterEvent.dueDate,
        fromAmount: beforeEvent.amount,
        toAmount: afterEvent.amount,
      });
    }
  }

  return changes;
}
