import type { CostRule, Plan, Vendor } from '../domain/schema';
import type { Bp, Money } from '../shared/money';

export type PaymentMilestone = Vendor['paymentSchedule'][number];
export type CancellationTier = Vendor['cancellation'][number];
export type TierBand = Extract<CostRule, { kind: 'PER_GUEST_TIERED' }>['tiers'][number];

/**
 * Converts major currency units to minor units (e.g. rupees to paise, dollars to cents).
 */
export const rupees = (n: number): Money => Math.round(n * 100);

/**
 * Converts major currency units to minor units (alias for rupees).
 */
export const dollars = rupees;

/**
 * Creates a FLAT cost rule.
 */
export function flat(id: string, label: string, amount: Money): CostRule {
  return { kind: 'FLAT', id, label, amount };
}

/**
 * Creates a PER_GUEST cost rule.
 */
export function perGuest(
  id: string,
  label: string,
  unitAmount: Money,
  minBillableGuests?: number,
): CostRule {
  return minBillableGuests !== undefined
    ? { kind: 'PER_GUEST', id, label, unitAmount, minBillableGuests }
    : { kind: 'PER_GUEST', id, label, unitAmount };
}

/**
 * Creates a PER_GUEST_TIERED cost rule.
 */
export function tiered(
  id: string,
  label: string,
  tiers: TierBand[],
  minBillableGuests?: number,
): CostRule {
  return minBillableGuests !== undefined
    ? { kind: 'PER_GUEST_TIERED', id, label, tiers, minBillableGuests }
    : { kind: 'PER_GUEST_TIERED', id, label, tiers };
}

/**
 * Creates a STEP cost rule.
 */
export function step(
  id: string,
  label: string,
  guestsPerUnit: number,
  unitAmount: Money,
): CostRule {
  return { kind: 'STEP', id, label, guestsPerUnit, unitAmount };
}

/**
 * Creates a SURCHARGE_PCT cost rule.
 */
export function surcharge(
  id: string,
  label: string,
  pctBp: Bp,
  base: 'BASE_ONLY' | 'BASE_PLUS_PRIOR_SURCHARGES',
): CostRule {
  return { kind: 'SURCHARGE_PCT', id, label, pctBp, base };
}

/**
 * Creates a payment milestone.
 */
export function milestone(
  id: string,
  label: string,
  pctBp: Bp,
  dueOffsetDays: number,
  paid: boolean,
): PaymentMilestone {
  return { id, label, pctBp, dueOffsetDays, paid };
}

/**
 * Creates a cancellation tier.
 */
export function cancel(minDaysBefore: number, forfeitPctBp: Bp): CancellationTier {
  return { minDaysBefore, forfeitPctBp };
}

/**
 * Creates a Vendor with defaults for testing.
 */
export function makeVendor(
  o: Partial<Vendor> & Pick<Vendor, 'id' | 'name' | 'category' | 'costRules'>,
): Vendor {
  return {
    status: 'CONFIRMED',
    paymentSchedule: [milestone('full', 'Full payment', 10_000, 7, false)],
    cancellation: [cancel(0, 10_000)],
    vendorCancelRefund: 'UNKNOWN',
    options: [],
    ...o,
  };
}

/**
 * Creates a Plan with defaults for testing.
 */
export function makePlan(o: Partial<Plan> & Pick<Plan, 'vendors'>): Plan {
  return {
    schemaVersion: 1,
    id: 'test-plan',
    name: 'Test plan',
    eventType: 'WEDDING',
    currency: 'INR',
    eventDate: '2026-12-12',
    asOfDate: '2026-10-28',
    guestCount: 100,
    budgetCap: rupees(1_000_000),
    priorities: { guests: 3, budget: 3, simplicity: 3 },
    ...o,
  };
}
