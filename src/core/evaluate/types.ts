import type { PaymentTimeline } from '../cost/payments';
import type { PlanCost } from '../cost/plan-cost';
import type { ISODate } from '../shared/dates';

export type TripwireStatus = 'OK' | 'AT_RISK' | 'NEEDS_VENDOR' | 'TRIPPED';
export type TripwireKind =
  | 'BUDGET_CAP'
  | 'VENUE_PRESENT'
  | 'VENUE_CAPACITY'
  | 'GUEST_LOCK'
  | 'PAYMENT'
  | 'LEAD_TIME'
  | 'DATE_AVAILABILITY'
  | 'VENDOR_DROPPED';
export type FactValue = number | string | boolean;

export interface Tripwire {
  readonly id: string;
  readonly kind: TripwireKind;
  readonly status: TripwireStatus;
  readonly code: string;
  readonly vendorId?: string;
  readonly facts: Readonly<Record<string, FactValue>>;
}

export interface Evaluation {
  readonly asOfDate: ISODate;
  readonly cost: PlanCost;
  readonly timeline: PaymentTimeline;
  readonly tripwires: readonly Tripwire[];
  readonly worst: TripwireStatus;
  readonly counts: Readonly<Record<TripwireStatus, number>>;
}

export const STATUS_SEVERITY: Readonly<Record<TripwireStatus, number>> = {
  OK: 0,
  AT_RISK: 1,
  NEEDS_VENDOR: 2,
  TRIPPED: 3,
};
export const NEAR_BUDGET_BP = 500; // headroom below 5% of the cap is AT_RISK
export const NEAR_CAPACITY_BP = 9_000; // guests above 90% of capacity is AT_RISK
export const LOCK_SOON_DAYS = 7;
