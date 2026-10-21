import type { Plan } from '../domain/schema';
import { addDays, compareISODate, type ISODate } from '../shared/dates';
import { splitByBp, sumMoney, type Money } from '../shared/money';
import { computeVendorCost } from './plan-cost';

/**
 * Payment milestone lifecycle status.
 */
export type PaymentStatus = 'PAID' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';

/**
 * Individual scheduled payment event for a vendor milestone.
 */
export interface PaymentEvent {
  vendorId: string;
  milestoneId: string;
  label: string;
  dueDate: ISODate;
  amount: Money;
  paid: boolean;
  status: PaymentStatus;
}

/**
 * Aggregate timeline of scheduled payments and current cashflow breakdown.
 */
export interface PaymentTimeline {
  events: PaymentEvent[];
  paidToDate: Money;
  remaining: Money;
  overdue: Money;
  dueToday: Money;
}

interface IndexedPaymentEvent extends PaymentEvent {
  vendorIndex: number;
  milestoneIndex: number;
}

/**
 * Computes the chronologically ordered payment timeline for all non-dropped vendors in a plan.
 *
 * Each vendor's total is split into milestone amounts using basis points via `splitByBp`.
 * Events are sorted primarily by dueDate ascending, secondary by vendor order in the plan,
 * and tertiary by milestone definition order.
 *
 * @param plan The plan whose payment timeline to evaluate.
 * @returns Complete PaymentTimeline with events and status breakdown sums.
 */
export function computePaymentTimeline(plan: Plan): PaymentTimeline {
  const indexedEvents: IndexedPaymentEvent[] = [];

  for (let vendorIdx = 0; vendorIdx < plan.vendors.length; vendorIdx++) {
    const vendor = plan.vendors[vendorIdx]!;
    if (vendor.status === 'DROPPED') {
      continue;
    }

    const vendorCost = computeVendorCost(vendor, plan);
    const bps = vendor.paymentSchedule.map((m) => m.pctBp);
    const amounts = splitByBp(vendorCost.total, bps);

    for (let mIdx = 0; mIdx < vendor.paymentSchedule.length; mIdx++) {
      const milestone = vendor.paymentSchedule[mIdx]!;
      const amount = amounts[mIdx]!;
      const dueDate = addDays(plan.eventDate, -milestone.dueOffsetDays);

      let status: PaymentStatus;
      if (milestone.paid) {
        status = 'PAID';
      } else {
        const cmp = compareISODate(dueDate, plan.asOfDate);
        if (cmp < 0) {
          status = 'OVERDUE';
        } else if (cmp === 0) {
          status = 'DUE_TODAY';
        } else {
          status = 'UPCOMING';
        }
      }

      indexedEvents.push({
        vendorId: vendor.id,
        milestoneId: milestone.id,
        label: milestone.label,
        dueDate,
        amount,
        paid: milestone.paid,
        status,
        vendorIndex: vendorIdx,
        milestoneIndex: mIdx,
      });
    }
  }

  indexedEvents.sort((a, b) => {
    const dateCmp = compareISODate(a.dueDate, b.dueDate);
    if (dateCmp !== 0) {
      return dateCmp;
    }
    if (a.vendorIndex !== b.vendorIndex) {
      return a.vendorIndex - b.vendorIndex;
    }
    return a.milestoneIndex - b.milestoneIndex;
  });

  const events: PaymentEvent[] = indexedEvents.map((item) => ({
    vendorId: item.vendorId,
    milestoneId: item.milestoneId,
    label: item.label,
    dueDate: item.dueDate,
    amount: item.amount,
    paid: item.paid,
    status: item.status,
  }));

  const paidAmounts: Money[] = [];
  const overdueAmounts: Money[] = [];
  const dueTodayAmounts: Money[] = [];
  const allAmounts: Money[] = [];

  for (const event of events) {
    allAmounts.push(event.amount);
    if (event.status === 'PAID') {
      paidAmounts.push(event.amount);
    } else if (event.status === 'OVERDUE') {
      overdueAmounts.push(event.amount);
    } else if (event.status === 'DUE_TODAY') {
      dueTodayAmounts.push(event.amount);
    }
  }

  const totalAll = sumMoney(allAmounts);
  const paidToDate = sumMoney(paidAmounts);
  const overdue = sumMoney(overdueAmounts);
  const dueToday = sumMoney(dueTodayAmounts);
  const remaining = totalAll - paidToDate;

  return {
    events,
    paidToDate,
    remaining,
    overdue,
    dueToday,
  };
}
