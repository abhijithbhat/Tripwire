import { describe, expect, it } from 'vitest';
import type { Plan } from '../domain/schema';
import { evaluatePlan } from '../evaluate/evaluate';
import type { Tripwire } from '../evaluate/types';
import { weddingPlan } from '../fixtures/wedding-120';
import { deepFreeze } from '../test-utils/deep-freeze';
import { assessChange } from './assess';
import { evaluateChangeAware, leadTimeStatus } from './change-aware';
import { diffPayments, diffTripwires, diffVendorCosts, escalationsOf } from './diff';
import type { ChangeImpact, TripwireDelta } from './types';

function getImpact(plan: Plan, changes: Parameters<typeof assessChange>[1]): ChangeImpact {
  const res = assessChange(deepFreeze(structuredClone(plan)), changes);
  if (!res.ok) throw new Error(`Unexpected failure: ${res.error.code}`);
  return res.impact;
}

describe('change-aware engine and tripwire tests', () => {
  describe('A. leadTimeStatus', () => {
    it('evaluates lead times correctly across boundaries', () => {
      expect(leadTimeStatus(6, 7)).toEqual({ status: 'NEEDS_VENDOR', code: 'LEAD_TIME_SHORT' });
      expect(leadTimeStatus(0, 7)).toEqual({ status: 'NEEDS_VENDOR', code: 'LEAD_TIME_SHORT' });
      expect(leadTimeStatus(7, 7)).toEqual({ status: 'AT_RISK', code: 'LEAD_TIME_TIGHT' });
      expect(leadTimeStatus(13, 7)).toEqual({ status: 'AT_RISK', code: 'LEAD_TIME_TIGHT' });
      expect(leadTimeStatus(14, 7)).toEqual({ status: 'OK', code: 'LEAD_TIME_OK' });
    });
  });

  describe('evaluateChangeAware edge cases', () => {
    it('returns empty array when no dates moved and no vendor costs changed', () => {
      const plan = deepFreeze(structuredClone(weddingPlan));
      const ev = evaluatePlan(plan);
      expect(evaluateChangeAware(plan, plan, ev, ev)).toEqual([]);
    });

    it('ignores vendors with undefined leadTimeDays when affected', () => {
      const before = deepFreeze(structuredClone(weddingPlan));
      const after: Plan = {
        ...before,
        vendors: before.vendors.map((v) => ({ ...v, leadTimeDays: undefined })),
        eventDate: '2026-11-20',
      };
      const extra = evaluateChangeAware(before, after, evaluatePlan(before), evaluatePlan(after));
      expect(extra.every((tw) => tw.kind === 'DATE_AVAILABILITY')).toBe(true);
    });

    it('emits NOTHING_PAID for dropped vendor with zero paid', () => {
      const before = deepFreeze(structuredClone(weddingPlan));
      const after: Plan = {
        ...before,
        vendors: before.vendors.map((v) => (v.id === 'decor' ? { ...v, status: 'DROPPED' } : v)),
      };
      const extra = evaluateChangeAware(before, after, evaluatePlan(before), evaluatePlan(after));
      const dropped = extra.find((tw) => tw.id === 'VENDOR_DROPPED:decor');
      expect(dropped).toEqual({
        id: 'VENDOR_DROPPED:decor',
        kind: 'VENDOR_DROPPED',
        status: 'OK',
        code: 'NOTHING_PAID',
        vendorId: 'decor',
        facts: { paidAtRisk: 0 },
      });
    });

    it('skips vendors that were already dropped in before', () => {
      const before: Plan = {
        ...weddingPlan,
        vendors: weddingPlan.vendors.map((v) =>
          v.id === 'decor' ? { ...v, status: 'DROPPED' } : v,
        ),
      };
      const after: Plan = { ...before, eventDate: '2026-11-20' };
      const extra = evaluateChangeAware(before, after, evaluatePlan(before), evaluatePlan(after));
      expect(extra.find((tw) => tw.id.includes('decor'))).toBeUndefined();
    });
  });

  describe('diff and escalation utilities', () => {
    const tw = (
      id: string,
      kind: Tripwire['kind'],
      status: Tripwire['status'],
      vendorId?: string,
    ): Tripwire => ({
      id,
      kind,
      status,
      code: 'X',
      ...(vendorId ? { vendorId } : {}),
      facts: {},
    });

    it('diffTripwires detects all delta types with vendorId', () => {
      const before = [
        tw('A', 'BUDGET_CAP', 'OK'),
        tw('B', 'VENUE_CAPACITY', 'AT_RISK', 'v'),
        tw('C', 'LEAD_TIME', 'TRIPPED'),
      ];
      const after = [
        tw('A', 'BUDGET_CAP', 'OK'),
        tw('B', 'VENUE_CAPACITY', 'OK', 'v'),
        tw('D', 'DATE_AVAILABILITY', 'NEEDS_VENDOR', 'v2'),
      ];
      expect(
        diffTripwires(before, after).map((d) => [
          d.id,
          d.kind,
          d.change,
          d.before,
          d.after,
          d.vendorId,
        ]),
      ).toEqual([
        ['A', 'BUDGET_CAP', 'UNCHANGED', 'OK', 'OK', undefined],
        ['B', 'VENUE_CAPACITY', 'IMPROVED', 'AT_RISK', 'OK', 'v'],
        ['D', 'DATE_AVAILABILITY', 'NEW', undefined, 'NEEDS_VENDOR', 'v2'],
        ['C', 'LEAD_TIME', 'REMOVED', 'TRIPPED', undefined, undefined],
      ]);
    });

    it('escalationsOf returns new or worsened tripwires that are not OK', () => {
      const after: Tripwire[] = [
        tw('N1', 'LEAD_TIME', 'OK'),
        tw('N2', 'LEAD_TIME', 'AT_RISK'),
        tw('W', 'BUDGET_CAP', 'TRIPPED'),
      ];
      const deltas: TripwireDelta[] = [
        { id: 'N1', kind: 'LEAD_TIME', change: 'NEW', after: 'OK' },
        { id: 'N2', kind: 'LEAD_TIME', change: 'NEW', after: 'AT_RISK' },
        { id: 'W', kind: 'BUDGET_CAP', change: 'WORSENED', before: 'OK', after: 'TRIPPED' },
      ];
      expect(escalationsOf(after, deltas).map((e) => e.id)).toEqual(['N2', 'W']);
    });

    it('diffPayments and diffVendorCosts return empty on identical plans', () => {
      const plan = deepFreeze(structuredClone(weddingPlan));
      const ev = evaluatePlan(plan);
      expect(diffPayments(ev, ev)).toEqual([]);
      expect(diffVendorCosts(plan, plan, ev, ev)).toEqual([]);
    });

    it('diffPayments ignores after events without matching before events', () => {
      const beforeEv = evaluatePlan(weddingPlan);
      const afterEv = {
        ...beforeEv,
        timeline: {
          ...beforeEv.timeline,
          events: [
            ...beforeEv.timeline.events,
            {
              vendorId: 'extra',
              milestoneId: 'm',
              label: 'X',
              dueDate: '2026-11-01',
              amount: 1,
              paid: false,
              status: 'UPCOMING' as const,
            },
          ],
        },
      };
      expect(diffPayments(beforeEv, afterEv)).toEqual([]);
    });
  });

  describe('change-aware scenarios (C, D, E)', () => {
    it("C. [EVENT_DATE_MOVE to '2026-11-22'] (daysUntilEvent 25)", () => {
      const impact = getImpact(weddingPlan, [{ kind: 'EVENT_DATE_MOVE', to: '2026-11-22' }]);
      expect(impact.assumptions).toEqual([]);
      expect(impact.planCostDelta).toBe(0);
      expect(impact.vendorCostDeltas).toEqual([]);

      expect(impact.after.tripwires.map((t) => `${t.id}:${t.status}`)).toEqual([
        'BUDGET_CAP:OK',
        'VENUE_CAPACITY:venue:OK',
        'GUEST_LOCK:catering:OK',
        'PAYMENT:venue.second:TRIPPED',
        'PAYMENT:decor.advance:TRIPPED',
        'LEAD_TIME:catering:OK',
        'LEAD_TIME:decor:AT_RISK',
        'LEAD_TIME:photo:AT_RISK',
        'DATE_AVAILABILITY:venue:NEEDS_VENDOR',
        'DATE_AVAILABILITY:catering:NEEDS_VENDOR',
        'DATE_AVAILABILITY:decor:NEEDS_VENDOR',
        'DATE_AVAILABILITY:photo:NEEDS_VENDOR',
      ]);
      const lock = impact.after.tripwires.find((t) => t.id === 'GUEST_LOCK:catering');
      expect(lock?.facts).toEqual({ daysToLock: 11, lockDate: '2026-11-08' });
      const payVenue = impact.after.tripwires.find((t) => t.id === 'PAYMENT:venue.second');
      expect(payVenue?.facts).toEqual({ amount: 10325000, dueDate: '2026-10-08', daysOverdue: 20 });
      const payDecor = impact.after.tripwires.find((t) => t.id === 'PAYMENT:decor.advance');
      expect(payDecor?.facts).toEqual({ amount: 9440000, dueDate: '2026-10-23', daysOverdue: 5 });
      const ltDecor = impact.after.tripwires.find((t) => t.id === 'LEAD_TIME:decor');
      expect(ltDecor?.code).toBe('LEAD_TIME_TIGHT');
      expect(ltDecor?.facts).toEqual({ daysUntilEvent: 25, leadTimeDays: 21 });
      const ltPhoto = impact.after.tripwires.find((t) => t.id === 'LEAD_TIME:photo');
      expect(ltPhoto?.code).toBe('LEAD_TIME_TIGHT');
      expect(ltPhoto?.facts).toEqual({ daysUntilEvent: 25, leadTimeDays: 14 });

      for (const vId of ['venue', 'catering', 'decor', 'photo']) {
        const da = impact.after.tripwires.find((t) => t.id === `DATE_AVAILABILITY:${vId}`);
        expect(da?.status).toBe('NEEDS_VENDOR');
        expect(da?.code).toBe('CONFIRM_NEW_DATE');
        expect(da?.facts).toEqual({ fromDate: '2026-12-12', toDate: '2026-11-22' });
      }

      expect(impact.after.counts).toEqual({ OK: 4, AT_RISK: 2, NEEDS_VENDOR: 4, TRIPPED: 2 });
      expect(impact.after.worst).toBe('TRIPPED');

      const dMap = new Map(impact.tripwireDeltas.map((d) => [d.id, d]));
      expect(dMap.get('PAYMENT:venue.second')).toMatchObject({
        change: 'WORSENED',
        before: 'AT_RISK',
        after: 'TRIPPED',
      });
      expect(dMap.get('BUDGET_CAP')?.change).toBe('UNCHANGED');
      expect(dMap.get('VENUE_CAPACITY:venue')?.change).toBe('UNCHANGED');
      expect(dMap.get('GUEST_LOCK:catering')?.change).toBe('UNCHANGED');
      const unchanged = new Set([
        'PAYMENT:venue.second',
        'BUDGET_CAP',
        'VENUE_CAPACITY:venue',
        'GUEST_LOCK:catering',
      ]);
      for (const [id, delta] of dMap.entries()) {
        if (!unchanged.has(id)) {
          expect(delta.change).toBe('NEW');
        }
      }

      expect(impact.escalations.map((t) => t.id)).toEqual([
        'PAYMENT:venue.second',
        'PAYMENT:decor.advance',
        'LEAD_TIME:decor',
        'LEAD_TIME:photo',
        'DATE_AVAILABILITY:venue',
        'DATE_AVAILABILITY:catering',
        'DATE_AVAILABILITY:decor',
        'DATE_AVAILABILITY:photo',
      ]);

      expect(
        impact.paymentChanges.map(
          (p) => `${p.vendorId}.${p.milestoneId} ${p.fromDate} -> ${p.toDate}`,
        ),
      ).toEqual([
        'venue.second 2026-10-28 -> 2026-10-08',
        'decor.advance 2026-11-12 -> 2026-10-23',
        'catering.second 2026-11-28 -> 2026-11-08',
        'photo.balance 2026-12-02 -> 2026-11-12',
        'venue.final 2026-12-05 -> 2026-11-15',
        'decor.final 2026-12-09 -> 2026-11-19',
        'catering.final 2026-12-10 -> 2026-11-20',
      ]);
    });

    it("D. [EVENT_DATE_MOVE to '2026-11-01']", () => {
      const impact = getImpact(weddingPlan, [{ kind: 'EVENT_DATE_MOVE', to: '2026-11-01' }]);
      expect(impact.assumptions).toEqual([
        { code: 'GUARANTEE_ASSUMED', vendorId: 'catering', guests: 120 },
      ]);
      const lock = impact.after.tripwires.find((t) => t.id === 'GUEST_LOCK:catering');
      expect(lock).toMatchObject({
        status: 'OK',
        code: 'LOCK_MATCHES',
        facts: { guaranteed: 120, guests: 120 },
      });

      for (const [vId, ltDays] of [
        ['catering', 7],
        ['decor', 21],
        ['photo', 14],
      ] as const) {
        const lt = impact.after.tripwires.find((t) => t.id === `LEAD_TIME:${vId}`);
        expect(lt).toMatchObject({
          status: 'NEEDS_VENDOR',
          code: 'LEAD_TIME_SHORT',
          facts: { daysUntilEvent: 4, leadTimeDays: ltDays },
        });
      }

      const payTws = impact.after.tripwires.filter((t) => t.kind === 'PAYMENT');
      expect(payTws.every((t) => t.status === 'TRIPPED')).toBe(true);
      expect(payTws.map((t) => t.id)).toEqual([
        'PAYMENT:venue.second',
        'PAYMENT:decor.advance',
        'PAYMENT:catering.second',
        'PAYMENT:photo.balance',
        'PAYMENT:venue.final',
      ]);
      const payVenue = payTws.find((t) => t.id === 'PAYMENT:venue.second');
      expect(payVenue?.facts?.['daysOverdue']).toBe(41);
    });

    it('E. [VENDOR_DROP venue] and refund variants', () => {
      const impact = getImpact(weddingPlan, [{ kind: 'VENDOR_DROP', vendorId: 'venue' }]);
      expect(impact.planCostDelta).toBe(-20650000);
      expect(impact.headroomDelta).toBe(20650000);
      expect(impact.vendorCostDeltas).toEqual([
        {
          vendorId: 'venue',
          before: 20650000,
          after: 0,
          delta: -20650000,
          dropped: true,
          paidToDate: 5162500,
          remainingAfter: 0,
          trueUp: 0,
        },
      ]);
      expect(impact.after.tripwires.map((t) => t.id)).toEqual([
        'BUDGET_CAP',
        'VENUE_PRESENT',
        'GUEST_LOCK:catering',
        'VENDOR_DROPPED:venue',
      ]);
      expect(impact.after.tripwires.map((t) => t.status)).toEqual([
        'OK',
        'TRIPPED',
        'OK',
        'NEEDS_VENDOR',
      ]);
      const droppedTw = impact.after.tripwires.find((t) => t.id === 'VENDOR_DROPPED:venue');
      expect(droppedTw?.code).toBe('REFUND_DUE_FROM_VENDOR');
      expect(droppedTw?.facts).toEqual({ paidAtRisk: 5162500 });
      expect(impact.after.counts).toEqual({ OK: 2, AT_RISK: 0, NEEDS_VENDOR: 1, TRIPPED: 1 });

      const deltas = impact.tripwireDeltas;
      const dMap = new Map(deltas.map((d) => [d.id, d]));
      expect(dMap.get('BUDGET_CAP')?.change).toBe('UNCHANGED');
      expect(dMap.get('VENUE_PRESENT')?.change).toBe('NEW');
      expect(dMap.get('GUEST_LOCK:catering')?.change).toBe('UNCHANGED');
      expect(dMap.get('VENDOR_DROPPED:venue')?.change).toBe('NEW');
      expect(dMap.get('VENUE_CAPACITY:venue')).toMatchObject({ change: 'REMOVED', before: 'OK' });
      expect(dMap.get('PAYMENT:venue.second')).toMatchObject({
        change: 'REMOVED',
        before: 'AT_RISK',
      });
      expect(impact.escalations.map((t) => t.id)).toEqual([
        'VENUE_PRESENT',
        'VENDOR_DROPPED:venue',
      ]);
      expect(impact.paymentChanges).toEqual([]);

      // Variant: NONE refund policy
      const venueNonePlan: Plan = {
        ...weddingPlan,
        vendors: weddingPlan.vendors.map((v) =>
          v.id === 'venue' ? { ...v, vendorCancelRefund: 'NONE' } : v,
        ),
      };
      const impactNone = getImpact(venueNonePlan, [{ kind: 'VENDOR_DROP', vendorId: 'venue' }]);
      expect(impactNone.after.tripwires.find((t) => t.id === 'VENDOR_DROPPED:venue')).toMatchObject(
        {
          status: 'TRIPPED',
          code: 'DEPOSIT_LOST',
          facts: { paidAtRisk: 5162500 },
        },
      );

      // Variant: photo (UNKNOWN)
      const impactPhoto = getImpact(weddingPlan, [{ kind: 'VENDOR_DROP', vendorId: 'photo' }]);
      expect(
        impactPhoto.after.tripwires.find((t) => t.id === 'VENDOR_DROPPED:photo'),
      ).toMatchObject({
        status: 'NEEDS_VENDOR',
        code: 'REFUND_TERMS_UNKNOWN',
        facts: { paidAtRisk: 4400000 },
      });

      // Variant: decor (0 paid)
      const impactDecor = getImpact(weddingPlan, [{ kind: 'VENDOR_DROP', vendorId: 'decor' }]);
      expect(
        impactDecor.after.tripwires.find((t) => t.id === 'VENDOR_DROPPED:decor'),
      ).toMatchObject({
        status: 'OK',
        code: 'NOTHING_PAID',
        facts: { paidAtRisk: 0 },
      });
      expect(impactDecor.vendorCostDeltas).toEqual([
        {
          vendorId: 'decor',
          before: 18880000,
          after: 0,
          delta: -18880000,
          dropped: true,
          paidToDate: 0,
          remainingAfter: 0,
          trueUp: 0,
        },
      ]);
    });
  });
});
