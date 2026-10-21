import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Plan } from '../domain/schema';
import { birthdayPlan } from '../fixtures/birthday-40';
import { makePlan, makeVendor, milestone, rupees } from '../fixtures/builders';
import { communityPlan } from '../fixtures/community-300';
import { GOLDEN } from '../fixtures/golden';
import { weddingPlan } from '../fixtures/wedding-120';
import { computePaymentTimeline } from './payments';
import { computePlanCost } from './plan-cost';

describe('Payment Engine', () => {
  describe('GOLDEN validation', () => {
    const plans = [
      { id: 'wedding-120' as const, plan: weddingPlan },
      { id: 'birthday-40' as const, plan: birthdayPlan },
      { id: 'community-300' as const, plan: communityPlan },
    ];

    it.each(plans)('computes matching payment timeline and totals for $id', ({ id, plan }) => {
      const expected = GOLDEN[id];
      const timeline = computePaymentTimeline(plan);

      expect(timeline.paidToDate).toBe(expected.paidToDate);
      expect(timeline.remaining).toBe(expected.remaining);
      expect(timeline.overdue).toBe(expected.overdue);
      expect(timeline.dueToday).toBe(expected.dueToday);

      expect(timeline.events).toHaveLength(expected.timeline.length);

      for (let i = 0; i < timeline.events.length; i++) {
        const actual = timeline.events[i]!;
        const exp = expected.timeline[i]!;

        expect(actual.dueDate).toBe(exp.date);
        expect(`${actual.vendorId}.${actual.milestoneId}`).toBe(exp.milestoneId);
        expect(actual.amount).toBe(exp.amount);
        expect(actual.status).toBe(exp.status);
      }
    });
  });

  describe('Status calculations and sorting', () => {
    it('accurately resolves OVERDUE, DUE_TODAY, UPCOMING, and PAID statuses', () => {
      const plan: Plan = makePlan({
        id: 'status-test',
        name: 'Status Test Plan',
        eventType: 'COMMUNITY',
        currency: 'INR',
        eventDate: '2026-12-01',
        asOfDate: '2026-11-15',
        guestCount: 50,
        budgetCap: rupees(100_000),
        priorities: { guests: 3, budget: 3, simplicity: 3 },
        vendors: [
          makeVendor({
            id: 'v1',
            name: 'Vendor One',
            category: 'OTHER',
            vendorCancelRefund: 'FULL',
            costRules: [{ id: 'r1', label: 'R1', kind: 'FLAT', amount: rupees(10_000) }],
            paymentSchedule: [
              // Due: 2026-11-11 (< 2026-11-15) -> OVERDUE
              milestone('m-overdue', 'Overdue', 2500, 20, false),
              // Due: 2026-11-15 (== 2026-11-15) -> DUE_TODAY
              milestone('m-today', 'Today', 2500, 16, false),
              // Due: 2026-11-21 (> 2026-11-15) -> UPCOMING
              milestone('m-upcoming', 'Upcoming', 2500, 10, false),
              // Due: 2026-11-01 (< asOfDate, but paid=true) -> PAID
              milestone('m-paid', 'Paid', 2500, 30, true),
            ],
            cancellation: [{ minDaysBefore: 0, forfeitPctBp: 10_000 }],
            options: [],
          }),
        ],
      });

      const timeline = computePaymentTimeline(plan);
      const byId = Object.fromEntries(timeline.events.map((e) => [e.milestoneId, e]));

      expect(byId['m-overdue']!.status).toBe('OVERDUE');
      expect(byId['m-today']!.status).toBe('DUE_TODAY');
      expect(byId['m-upcoming']!.status).toBe('UPCOMING');
      expect(byId['m-paid']!.status).toBe('PAID');
    });

    it('breaks dueDate ties using vendor order then milestone order', () => {
      const plan: Plan = makePlan({
        id: 'tie-test',
        name: 'Tie Test Plan',
        eventType: 'COMMUNITY',
        currency: 'INR',
        eventDate: '2026-12-01',
        asOfDate: '2026-11-01',
        guestCount: 50,
        budgetCap: rupees(100_000),
        priorities: { guests: 3, budget: 3, simplicity: 3 },
        vendors: [
          makeVendor({
            id: 'vendor-a',
            name: 'Vendor A',
            category: 'OTHER',
            vendorCancelRefund: 'FULL',
            costRules: [{ id: 'r1', label: 'R1', kind: 'FLAT', amount: rupees(10_000) }],
            paymentSchedule: [
              milestone('first', 'First', 5000, 10, false),
              milestone('second', 'Second', 5000, 10, false),
            ],
            cancellation: [{ minDaysBefore: 0, forfeitPctBp: 10_000 }],
            options: [],
          }),
          makeVendor({
            id: 'vendor-b',
            name: 'Vendor B',
            category: 'OTHER',
            vendorCancelRefund: 'FULL',
            costRules: [{ id: 'r2', label: 'R2', kind: 'FLAT', amount: rupees(10_000) }],
            paymentSchedule: [milestone('first', 'First', 10_000, 10, false)],
            cancellation: [{ minDaysBefore: 0, forfeitPctBp: 10_000 }],
            options: [],
          }),
        ],
      });

      const timeline = computePaymentTimeline(plan);
      expect(timeline.events).toHaveLength(3);
      expect(timeline.events[0]!.vendorId).toBe('vendor-a');
      expect(timeline.events[0]!.milestoneId).toBe('first');
      expect(timeline.events[1]!.vendorId).toBe('vendor-a');
      expect(timeline.events[1]!.milestoneId).toBe('second');
      expect(timeline.events[2]!.vendorId).toBe('vendor-b');
      expect(timeline.events[2]!.milestoneId).toBe('first');
    });
  });

  describe('DROPPED vendor handling', () => {
    it('omits dropped vendors from the payment timeline', () => {
      const weddingWithoutDecor: Plan = {
        ...weddingPlan,
        vendors: weddingPlan.vendors.map((v) =>
          v.id === 'decor' ? { ...v, status: 'DROPPED' as const } : v,
        ),
      };

      const timeline = computePaymentTimeline(weddingWithoutDecor);
      const decorEvents = timeline.events.filter((e) => e.vendorId === 'decor');
      expect(decorEvents).toHaveLength(0);

      const planCost = computePlanCost(weddingWithoutDecor);
      const sumEvents = timeline.events.reduce((acc, e) => acc + e.amount, 0);
      expect(sumEvents).toBe(planCost.total);
      expect(timeline.paidToDate + timeline.remaining).toBe(planCost.total);
    });
  });

  describe('Property tests', () => {
    it('ensures timeline event amounts sum to total of non-dropped vendors and paidToDate + remaining equals total', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 400 }), (guests) => {
          const plan: Plan = { ...weddingPlan, guestCount: guests };
          const timeline = computePaymentTimeline(plan);
          const planCost = computePlanCost(plan);

          const eventSum = timeline.events.reduce((acc, e) => acc + e.amount, 0);
          expect(eventSum).toBe(planCost.total);
          expect(timeline.paidToDate + timeline.remaining).toBe(planCost.total);
        }),
      );
    });

    it('is deterministic and safe on deep-frozen plans', () => {
      const frozenPlan: Plan = Object.freeze({
        ...weddingPlan,
        vendors: weddingPlan.vendors.map((v) => Object.freeze({ ...v })),
      });

      const res1 = computePaymentTimeline(frozenPlan);
      const res2 = computePaymentTimeline(frozenPlan);
      expect(res1).toEqual(res2);
    });
  });
});
