import type { Plan } from '../domain/schema';
import type { Evaluation, Tripwire, TripwireStatus } from '../evaluate/types';
import { diffDays } from '../shared/dates';

/**
 * Computes lead time status and code given days until event and vendor lead time.
 *
 * @param daysUntilEvent Number of calendar days until the event.
 * @param leadTimeDays Vendor's required lead time in days.
 * @returns Status and code.
 */
export function leadTimeStatus(
  daysUntilEvent: number,
  leadTimeDays: number,
): { status: TripwireStatus; code: string } {
  if (daysUntilEvent < leadTimeDays) {
    return { status: 'NEEDS_VENDOR', code: 'LEAD_TIME_SHORT' };
  }
  if (daysUntilEvent < 2 * leadTimeDays) {
    return { status: 'AT_RISK', code: 'LEAD_TIME_TIGHT' };
  }
  return { status: 'OK', code: 'LEAD_TIME_OK' };
}

/**
 * Evaluates change-aware tripwires between two plan states (before and after).
 * Emits LEAD_TIME, DATE_AVAILABILITY, and VENDOR_DROPPED tripwires in order.
 *
 * @param before Plan before changes.
 * @param after Plan after changes.
 * @param beforeEval Evaluation of the before plan.
 * @param afterEval Evaluation of the base after plan.
 * @returns Array of change-aware Tripwires.
 */
export function evaluateChangeAware(
  before: Plan,
  after: Plan,
  beforeEval: Evaluation,
  afterEval: Evaluation,
): Tripwire[] {
  const dateMoved = before.eventDate !== after.eventDate;
  const daysUntilEvent = diffDays(after.eventDate, after.asOfDate);

  const beforeVendorCostMap = new Map(beforeEval.cost.vendors.map((vc) => [vc.vendorId, vc.total]));
  const afterVendorCostMap = new Map(afterEval.cost.vendors.map((vc) => [vc.vendorId, vc.total]));

  const leadTimeTripwires: Tripwire[] = [];
  const dateTripwires: Tripwire[] = [];
  const droppedTripwires: Tripwire[] = [];

  // LEAD_TIME & DATE_AVAILABILITY across after vendors
  for (const vendor of after.vendors) {
    if (vendor.status !== 'CONFIRMED') continue;

    const beforeCost = beforeVendorCostMap.get(vendor.id) ?? 0;
    const afterCost = afterVendorCostMap.get(vendor.id) ?? 0;
    const isAffected = dateMoved || beforeCost !== afterCost;

    if (isAffected && vendor.leadTimeDays !== undefined) {
      const { status, code } = leadTimeStatus(daysUntilEvent, vendor.leadTimeDays);
      leadTimeTripwires.push({
        id: `LEAD_TIME:${vendor.id}`,
        kind: 'LEAD_TIME',
        status,
        code,
        vendorId: vendor.id,
        facts: { daysUntilEvent, leadTimeDays: vendor.leadTimeDays },
      });
    }

    if (dateMoved) {
      dateTripwires.push({
        id: `DATE_AVAILABILITY:${vendor.id}`,
        kind: 'DATE_AVAILABILITY',
        status: 'NEEDS_VENDOR',
        code: 'CONFIRM_NEW_DATE',
        vendorId: vendor.id,
        facts: { fromDate: before.eventDate, toDate: after.eventDate },
      });
    }
  }

  // VENDOR_DROPPED across vendors confirmed in before and dropped in after
  const afterVendorMap = new Map(after.vendors.map((v) => [v.id, v]));
  for (const beforeVendor of before.vendors) {
    if (beforeVendor.status !== 'CONFIRMED') continue;
    const afterVendor = afterVendorMap.get(beforeVendor.id);
    if (!afterVendor || afterVendor.status !== 'DROPPED') continue;

    let paidAtRisk = 0;
    for (const event of beforeEval.timeline.events) {
      if (event.vendorId === beforeVendor.id && event.paid) {
        paidAtRisk += event.amount;
      }
    }

    let status: TripwireStatus;
    let code: string;

    if (paidAtRisk === 0) {
      status = 'OK';
      code = 'NOTHING_PAID';
    } else {
      switch (beforeVendor.vendorCancelRefund) {
        case 'FULL':
          status = 'NEEDS_VENDOR';
          code = 'REFUND_DUE_FROM_VENDOR';
          break;
        case 'UNKNOWN':
          status = 'NEEDS_VENDOR';
          code = 'REFUND_TERMS_UNKNOWN';
          break;
        case 'NONE':
          status = 'TRIPPED';
          code = 'DEPOSIT_LOST';
          break;
      }
    }

    droppedTripwires.push({
      id: `VENDOR_DROPPED:${beforeVendor.id}`,
      kind: 'VENDOR_DROPPED',
      status,
      code,
      vendorId: beforeVendor.id,
      facts: { paidAtRisk },
    });
  }

  return [...leadTimeTripwires, ...dateTripwires, ...droppedTripwires];
}
