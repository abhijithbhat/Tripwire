import type { ApplyError, Assumption } from '../change/apply';
import type { Change } from '../change/schema';
import type { Evaluation, Tripwire, TripwireKind, TripwireStatus } from '../evaluate/types';
import type { ISODate } from '../shared/dates';
import type { Money } from '../shared/money';

export type DeltaChange = 'NEW' | 'REMOVED' | 'WORSENED' | 'IMPROVED' | 'UNCHANGED';

export interface TripwireDelta {
  readonly id: string;
  readonly kind: TripwireKind;
  readonly vendorId?: string;
  readonly change: DeltaChange;
  readonly before?: TripwireStatus;
  readonly after?: TripwireStatus;
}

export interface VendorCostDelta {
  readonly vendorId: string;
  readonly before: Money;
  readonly after: Money;
  readonly delta: Money;
  readonly dropped: boolean;
  readonly paidToDate: Money;
  readonly remainingAfter: Money;
  readonly trueUp: Money;
}

export interface PaymentChange {
  readonly vendorId: string;
  readonly milestoneId: string;
  readonly label: string;
  readonly fromDate: ISODate;
  readonly toDate: ISODate;
  readonly fromAmount: Money;
  readonly toAmount: Money;
}

export interface ChangeImpact {
  readonly changes: readonly Change[];
  readonly assumptions: readonly Assumption[];
  readonly before: Evaluation;
  readonly after: Evaluation;
  readonly planCostDelta: Money;
  readonly headroomDelta: Money;
  readonly vendorCostDeltas: readonly VendorCostDelta[];
  readonly tripwireDeltas: readonly TripwireDelta[];
  readonly escalations: readonly Tripwire[];
  readonly paymentChanges: readonly PaymentChange[];
}

export type AssessResult = { ok: true; impact: ChangeImpact } | { ok: false; error: ApplyError };
