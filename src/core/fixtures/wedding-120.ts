import type { Plan } from '../domain/schema';
import {
  cancel,
  flat,
  makePlan,
  makeVendor,
  milestone,
  perGuest,
  rupees,
  step,
  surcharge,
} from './builders';

export const weddingPlan: Plan = makePlan({
  id: 'wedding-120',
  name: 'Aarav & Diya - Wedding Reception',
  eventType: 'WEDDING',
  currency: 'INR',
  eventDate: '2026-12-12',
  asOfDate: '2026-10-28',
  guestCount: 120,
  budgetCap: rupees(700_000),
  priorities: { guests: 3, budget: 4, simplicity: 2 },
  vendors: [
    makeVendor({
      id: 'venue',
      name: 'Hall Meridian',
      category: 'VENUE',
      capacity: 150,
      vendorCancelRefund: 'FULL',
      costRules: [
        flat('rental', 'Rental', rupees(150_000)),
        flat('av', 'Av', rupees(25_000)),
        surcharge('gst', 'Gst', 1800, 'BASE_ONLY'),
      ],
      paymentSchedule: [
        milestone('deposit', 'Deposit', 2500, 120, true),
        milestone('second', 'Second', 5000, 45, false),
        milestone('final', 'Final', 2500, 7, false),
      ],
      cancellation: [cancel(90, 2000), cancel(30, 5000), cancel(0, 10_000)],
      options: [
        {
          id: 'grand-ballroom',
          label: 'Grand Ballroom',
          capacity: 220,
          switchFee: rupees(10_000),
          costRules: [
            flat('rental', 'Rental', rupees(240_000)),
            flat('av', 'Av', rupees(25_000)),
            surcharge('gst', 'Gst', 1800, 'BASE_ONLY'),
          ],
        },
      ],
    }),
    makeVendor({
      id: 'catering',
      name: 'Spice Route Caterers',
      category: 'CATERING',
      vendorCancelRefund: 'FULL',
      leadTimeDays: 7,
      costRules: [
        perGuest('plates', 'Plates', rupees(950), 100),
        step('staff', 'Staff', 50, rupees(6000)),
        surcharge('service-charge', 'Service Charge', 1000, 'BASE_ONLY'),
        surcharge('gst', 'Gst', 500, 'BASE_PLUS_PRIOR_SURCHARGES'),
      ],
      paymentSchedule: [
        milestone('advance', 'Advance', 3000, 60, true),
        milestone('second', 'Second', 4000, 14, false),
        milestone('final', 'Final', 3000, 2, false),
      ],
      cancellation: [cancel(60, 2500), cancel(14, 6000), cancel(0, 10_000)],
      lock: {
        lockOffsetDays: 14,
        reductionsAllowedAfterLock: false,
        increaseAllowedUntilOffsetDays: 3,
        increaseTolerancePctBp: 1000,
      },
      options: [
        {
          id: 'premium-menu',
          label: 'Premium menu',
          switchFee: 0,
          costRules: [
            perGuest('plates', 'Plates', rupees(1250), 100),
            step('staff', 'Staff', 50, rupees(6000)),
            surcharge('service-charge', 'Service Charge', 1000, 'BASE_ONLY'),
            surcharge('gst', 'Gst', 500, 'BASE_PLUS_PRIOR_SURCHARGES'),
          ],
        },
        {
          id: 'buffet-lite',
          label: 'Buffet (lite)',
          switchFee: 0,
          costRules: [
            perGuest('plates', 'Plates', rupees(750), 100),
            step('staff', 'Staff', 75, rupees(6000)),
            surcharge('service-charge', 'Service Charge', 1000, 'BASE_ONLY'),
            surcharge('gst', 'Gst', 500, 'BASE_PLUS_PRIOR_SURCHARGES'),
          ],
        },
      ],
    }),
    makeVendor({
      id: 'decor',
      name: 'Petal & Pine Decor',
      category: 'DECOR',
      vendorCancelRefund: 'UNKNOWN',
      leadTimeDays: 21,
      costRules: [
        flat('stage', 'Stage', rupees(120_000)),
        flat('florals', 'Florals', rupees(40_000)),
        surcharge('gst', 'Gst', 1800, 'BASE_ONLY'),
      ],
      paymentSchedule: [
        milestone('advance', 'Advance', 5000, 30, false),
        milestone('final', 'Final', 5000, 3, false),
      ],
      cancellation: [cancel(30, 3000), cancel(0, 10_000)],
      options: [],
    }),
    makeVendor({
      id: 'photo',
      name: 'Frame Story Studios',
      category: 'PHOTO_VIDEO',
      vendorCancelRefund: 'UNKNOWN',
      leadTimeDays: 14,
      costRules: [flat('coverage', 'Coverage', rupees(110_000))],
      paymentSchedule: [
        milestone('booking', 'Booking', 4000, 90, true),
        milestone('balance', 'Balance', 6000, 10, false),
      ],
      cancellation: [cancel(45, 5000), cancel(0, 10_000)],
      options: [],
    }),
  ],
});
