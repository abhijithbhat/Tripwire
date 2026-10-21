import type { Plan } from '../domain/schema';
import {
  cancel,
  dollars,
  flat,
  makePlan,
  makeVendor,
  milestone,
  surcharge,
  tiered,
} from './builders';

export const birthdayPlan: Plan = makePlan({
  id: 'birthday-40',
  name: "Mira's 8th Birthday Party",
  eventType: 'BIRTHDAY',
  currency: 'USD',
  eventDate: '2026-11-21',
  asOfDate: '2026-10-28',
  guestCount: 40,
  budgetCap: dollars(1200),
  priorities: { guests: 4, budget: 3, simplicity: 4 },
  vendors: [
    makeVendor({
      id: 'venue',
      name: 'Maple Community Hall',
      category: 'VENUE',
      capacity: 50,
      vendorCancelRefund: 'FULL',
      costRules: [
        flat('rental', 'Rental', dollars(250)),
        flat('cleaning', 'Cleaning', dollars(50)),
      ],
      paymentSchedule: [
        milestone('deposit', 'Deposit', 5000, 21, false),
        milestone('balance', 'Balance', 5000, 0, false),
      ],
      cancellation: [cancel(14, 2500), cancel(0, 10_000)],
      options: [],
    }),
    makeVendor({
      id: 'catering',
      name: 'Party Pizza Co.',
      category: 'CATERING',
      vendorCancelRefund: 'FULL',
      leadTimeDays: 3,
      costRules: [
        tiered(
          'pizza',
          'Pizza',
          [
            { fromGuests: 0, unitAmount: dollars(16) },
            { fromGuests: 30, unitAmount: dollars(14) },
            { fromGuests: 60, unitAmount: dollars(12) },
          ],
          20,
        ),
        surcharge('sales-tax', 'Sales Tax', 700, 'BASE_ONLY'),
      ],
      paymentSchedule: [milestone('full', 'Full', 10_000, 7, false)],
      cancellation: [cancel(7, 1000), cancel(0, 10_000)],
      lock: {
        lockOffsetDays: 7,
        reductionsAllowedAfterLock: false,
        increaseAllowedUntilOffsetDays: 2,
        increaseTolerancePctBp: 2000,
      },
      options: [],
    }),
    makeVendor({
      id: 'entertainer',
      name: 'Bubbles the Magician',
      category: 'MUSIC_ENTERTAINMENT',
      vendorCancelRefund: 'UNKNOWN',
      leadTimeDays: 7,
      costRules: [flat('show', 'Show', dollars(180))],
      paymentSchedule: [
        milestone('deposit', 'Deposit', 5000, 14, true),
        milestone('balance', 'Balance', 5000, 0, false),
      ],
      cancellation: [cancel(14, 0), cancel(0, 10_000)],
      options: [],
    }),
  ],
});
