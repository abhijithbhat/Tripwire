import type { Plan, Vendor } from '../domain/schema';
import { addDays, compareISODate } from '../shared/dates';
import { sumMoney, type Money } from '../shared/money';
import { computeRulesCost, type CostLine } from './rules';

/**
 * Breakdown of computed costs for a single vendor under a plan.
 */
export interface VendorCost {
  vendorId: string;
  attendingGuests: number;
  billableGuests: number;
  lines: CostLine[];
  baseSubtotal: Money;
  total: Money;
}

/**
 * Total cost breakdown of an entire plan across all vendors.
 */
export interface PlanCost {
  total: Money;
  vendors: VendorCost[];
  budgetCap: Money;
  headroom: Money; // headroom = budgetCap - total, may be negative
}

/**
 * Determines whether a vendor's guest count lock is currently active.
 *
 * The lock date is defined as `addDays(eventDate, -lock.lockOffsetDays)`.
 * The lock is active when `asOfDate >= lockDate` (the lock date itself counts as locked).
 * If the vendor has no lock specified, returns false.
 *
 * @param vendor The vendor to check.
 * @param plan Plan dates used to evaluate the lock.
 * @returns True if the lock is active, false otherwise.
 */
export function isLockActive(vendor: Vendor, plan: Pick<Plan, 'eventDate' | 'asOfDate'>): boolean {
  if (!vendor.lock) {
    return false;
  }
  const lockDate = addDays(plan.eventDate, -vendor.lock.lockOffsetDays);
  return compareISODate(plan.asOfDate, lockDate) >= 0;
}

/**
 * Calculates the billable guest count for a vendor based on guest lock rules.
 *
 * If the lock is active, reductions are not allowed after lock, and guaranteedGuests
 * is defined, billable guests is `max(guestCount, guaranteedGuests)`.
 * Otherwise, billable guests equals `plan.guestCount`.
 *
 * @param vendor The vendor to evaluate.
 * @param plan Guest count and dates from the plan.
 * @returns The number of billable guests.
 */
export function billableGuestsFor(
  vendor: Vendor,
  plan: Pick<Plan, 'guestCount' | 'eventDate' | 'asOfDate'>,
): number {
  if (
    vendor.lock &&
    isLockActive(vendor, plan) &&
    !vendor.lock.reductionsAllowedAfterLock &&
    vendor.lock.guaranteedGuests !== undefined
  ) {
    return Math.max(plan.guestCount, vendor.lock.guaranteedGuests);
  }
  return plan.guestCount;
}

/**
 * Computes the cost lines and totals for a single vendor in a plan.
 * A vendor with status 'DROPPED' produces no cost lines and total 0.
 *
 * @param vendor The vendor to evaluate.
 * @param plan The full plan context.
 * @returns Computed VendorCost.
 */
export function computeVendorCost(vendor: Vendor, plan: Plan): VendorCost {
  const attendingGuests = plan.guestCount;
  const billableGuests = billableGuestsFor(vendor, plan);

  if (vendor.status === 'DROPPED') {
    return {
      vendorId: vendor.id,
      attendingGuests,
      billableGuests,
      lines: [],
      baseSubtotal: 0,
      total: 0,
    };
  }

  const { lines, baseSubtotal, total } = computeRulesCost(vendor.costRules, {
    attending: attendingGuests,
    billable: billableGuests,
  });

  return {
    vendorId: vendor.id,
    attendingGuests,
    billableGuests,
    lines,
    baseSubtotal,
    total,
  };
}

/**
 * Computes the total cost of a plan across all vendors and calculates remaining headroom.
 *
 * @param plan The plan to evaluate.
 * @returns Computed PlanCost including vendor breakdown and headroom.
 */
export function computePlanCost(plan: Plan): PlanCost {
  const vendors = plan.vendors.map((vendor) => computeVendorCost(vendor, plan));
  const total = sumMoney(vendors.map((v) => v.total));
  const headroom = plan.budgetCap - total;

  return {
    total,
    vendors,
    budgetCap: plan.budgetCap,
    headroom,
  };
}
