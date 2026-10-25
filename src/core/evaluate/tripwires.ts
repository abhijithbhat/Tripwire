import { type PaymentTimeline } from '../cost/payments';
import { computeVendorCost, isLockActive, type PlanCost } from '../cost/plan-cost';
import type { Plan, Vendor } from '../domain/schema';
import { addDays, compareISODate, diffDays } from '../shared/dates';
import {
  LOCK_SOON_DAYS,
  NEAR_BUDGET_BP,
  NEAR_CAPACITY_BP,
  type FactValue,
  type Tripwire,
} from './types';

/**
 * Evaluates the BUDGET_CAP state tripwire.
 *
 * @param plan Starting plan.
 * @param cost Computed plan cost.
 * @returns BUDGET_CAP Tripwire.
 */
export function evaluateBudgetCap(plan: Plan, cost: PlanCost): Tripwire {
  const cap = plan.budgetCap;
  const total = cost.total;
  const headroom = cap - total;
  const isOver = headroom < 0;
  const isNear = headroom * 10_000 < cap * NEAR_BUDGET_BP;

  return {
    id: 'BUDGET_CAP',
    kind: 'BUDGET_CAP',
    status: isOver ? 'TRIPPED' : isNear ? 'AT_RISK' : 'OK',
    code: isOver ? 'OVER_BUDGET' : isNear ? 'NEAR_BUDGET' : 'WITHIN_BUDGET',
    facts: isOver ? { total, cap, headroom, overBy: -headroom } : { total, cap, headroom },
  };
}

/**
 * Evaluates the VENUE_PRESENT tripwire.
 * Emitted ONLY if the plan has at least one VENUE vendor and none is CONFIRMED.
 *
 * @param plan Starting plan.
 * @returns VENUE_PRESENT Tripwire or undefined.
 */
export function evaluateVenuePresent(plan: Plan): Tripwire | undefined {
  const venues = plan.vendors.filter((v) => v.category === 'VENUE');
  if (venues.length === 0 || venues.some((v) => v.status === 'CONFIRMED')) {
    return undefined;
  }
  return {
    id: 'VENUE_PRESENT',
    kind: 'VENUE_PRESENT',
    status: 'TRIPPED',
    code: 'NO_VENUE',
    facts: {},
  };
}

/**
 * Evaluates VENUE_CAPACITY tripwires for all CONFIRMED vendors with defined capacity.
 *
 * @param plan Starting plan.
 * @returns Array of VENUE_CAPACITY Tripwires.
 */
export function evaluateVenueCapacity(plan: Plan): Tripwire[] {
  const tripwires: Tripwire[] = [];
  const guests = plan.guestCount;

  for (const vendor of plan.vendors) {
    if (vendor.status !== 'CONFIRMED' || vendor.capacity === undefined) continue;
    const capacity = vendor.capacity;
    const over = guests - capacity;
    const isOver = over > 0;
    const isNear = guests * 10_000 > capacity * NEAR_CAPACITY_BP;
    tripwires.push({
      id: `VENUE_CAPACITY:${vendor.id}`,
      kind: 'VENUE_CAPACITY',
      status: isOver ? 'TRIPPED' : isNear ? 'AT_RISK' : 'OK',
      code: isOver ? 'OVER_CAPACITY' : isNear ? 'NEAR_CAPACITY' : 'WITHIN_CAPACITY',
      vendorId: vendor.id,
      facts: isOver ? { guests, capacity, over } : { guests, capacity, free: -over },
    });
  }

  return tripwires;
}

function evaluateActiveLock(vendor: Vendor, plan: Plan): Tripwire {
  const lock = vendor.lock!;
  const guests = plan.guestCount;
  const g = lock.guaranteedGuests ?? guests;

  if (guests < g) {
    if (lock.reductionsAllowedAfterLock) {
      return {
        id: `GUEST_LOCK:${vendor.id}`,
        kind: 'GUEST_LOCK',
        status: 'OK',
        code: 'LOCK_REDUCTION_ALLOWED',
        vendorId: vendor.id,
        facts: { guaranteed: g, guests },
      };
    }
    const vendorWithReductions: Vendor = {
      ...vendor,
      lock: { ...lock, reductionsAllowedAfterLock: true },
    };
    const wastedCost =
      computeVendorCost(vendor, plan).total - computeVendorCost(vendorWithReductions, plan).total;
    return {
      id: `GUEST_LOCK:${vendor.id}`,
      kind: 'GUEST_LOCK',
      status: 'TRIPPED',
      code: 'REDUCTION_NOT_REFUNDABLE',
      vendorId: vendor.id,
      facts: { guaranteed: g, guests, paidForUnused: g - guests, wastedCost },
    };
  }

  if (guests === g) {
    return {
      id: `GUEST_LOCK:${vendor.id}`,
      kind: 'GUEST_LOCK',
      status: 'OK',
      code: 'LOCK_MATCHES',
      vendorId: vendor.id,
      facts: { guaranteed: g, guests },
    };
  }

  const extra = guests - g;
  const maxExtra = Math.floor((g * (lock.increaseTolerancePctBp ?? 0)) / 10_000);
  const deadline =
    lock.increaseAllowedUntilOffsetDays === undefined
      ? undefined
      : addDays(plan.eventDate, -lock.increaseAllowedUntilOffsetDays);
  const windowOpen = deadline !== undefined && compareISODate(plan.asOfDate, deadline) <= 0;

  if (windowOpen && extra <= maxExtra) {
    return {
      id: `GUEST_LOCK:${vendor.id}`,
      kind: 'GUEST_LOCK',
      status: 'AT_RISK',
      code: 'LATE_INCREASE_WITHIN_TOLERANCE',
      vendorId: vendor.id,
      facts: { extra, maxExtra, deadline },
    };
  }

  const facts: Record<string, FactValue> = { extra, maxExtra, windowOpen };
  if (deadline !== undefined) facts['deadline'] = deadline;
  return {
    id: `GUEST_LOCK:${vendor.id}`,
    kind: 'GUEST_LOCK',
    status: 'NEEDS_VENDOR',
    code: 'INCREASE_NEEDS_APPROVAL',
    vendorId: vendor.id,
    facts,
  };
}

/**
 * Evaluates GUEST_LOCK tripwires for all CONFIRMED vendors that have a lock.
 *
 * @param plan Starting plan.
 * @returns Array of GUEST_LOCK Tripwires.
 */
export function evaluateGuestLocks(plan: Plan): Tripwire[] {
  const tripwires: Tripwire[] = [];

  for (const vendor of plan.vendors) {
    if (vendor.status !== 'CONFIRMED' || !vendor.lock) continue;
    const lockDate = addDays(plan.eventDate, -vendor.lock.lockOffsetDays);
    if (!isLockActive(vendor, plan)) {
      const daysToLock = diffDays(lockDate, plan.asOfDate);
      const isSoon = daysToLock <= LOCK_SOON_DAYS;
      tripwires.push({
        id: `GUEST_LOCK:${vendor.id}`,
        kind: 'GUEST_LOCK',
        status: isSoon ? 'AT_RISK' : 'OK',
        code: isSoon ? 'LOCK_SOON' : 'LOCK_NOT_REACHED',
        vendorId: vendor.id,
        facts: { daysToLock, lockDate },
      });
    } else {
      tripwires.push(evaluateActiveLock(vendor, plan));
    }
  }

  return tripwires;
}

/**
 * Evaluates PAYMENT tripwires from the payment timeline.
 * Emits tripwires only for OVERDUE and DUE_TODAY events.
 *
 * @param plan Starting plan.
 * @param timeline Payment timeline.
 * @returns Array of PAYMENT Tripwires.
 */
export function evaluatePayments(plan: Plan, timeline: PaymentTimeline): Tripwire[] {
  const tripwires: Tripwire[] = [];

  for (const event of timeline.events) {
    if (event.status === 'OVERDUE') {
      tripwires.push({
        id: `PAYMENT:${event.vendorId}.${event.milestoneId}`,
        kind: 'PAYMENT',
        status: 'TRIPPED',
        code: 'PAYMENT_OVERDUE',
        vendorId: event.vendorId,
        facts: {
          amount: event.amount,
          dueDate: event.dueDate,
          daysOverdue: diffDays(plan.asOfDate, event.dueDate),
        },
      });
    } else if (event.status === 'DUE_TODAY') {
      tripwires.push({
        id: `PAYMENT:${event.vendorId}.${event.milestoneId}`,
        kind: 'PAYMENT',
        status: 'AT_RISK',
        code: 'PAYMENT_DUE_TODAY',
        vendorId: event.vendorId,
        facts: { amount: event.amount, dueDate: event.dueDate },
      });
    }
  }

  return tripwires;
}
