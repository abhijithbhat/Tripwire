import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyChange } from '../change/apply';
import type { Plan } from '../domain/schema';
import { evaluatePlan } from '../evaluate/evaluate';
import { birthdayPlan } from '../fixtures/birthday-40';
import { communityPlan } from '../fixtures/community-300';
import { weddingPlan } from '../fixtures/wedding-120';
import { deepFreeze } from '../test-utils/deep-freeze';
import { assessChange } from './assess';
import type { ChangeImpact } from './types';

function getImpact(plan: Plan, changes: Parameters<typeof assessChange>[1]): ChangeImpact {
  const res = assessChange(deepFreeze(structuredClone(plan)), changes);
  if (!res.ok) throw new Error(`Unexpected failure: ${res.error.code}`);
  return res.impact;
}

describe('assessChange scenario and property tests', () => {
  it('B. [GUEST_COUNT_DELTA +50]', () => {
    const impact = getImpact(weddingPlan, [{ kind: 'GUEST_COUNT_DELTA', delta: 50 }]);
    expect(impact.planCostDelta).toBe(6179250);
    expect(impact.headroomDelta).toBe(-6179250);
    expect(impact.vendorCostDeltas).toEqual([
      {
        vendorId: 'catering',
        before: 15246000,
        after: 21425250,
        delta: 6179250,
        dropped: false,
        paidToDate: 4573800,
        remainingAfter: 16851450,
        trueUp: 1853775,
      },
    ]);
    expect(impact.after.tripwires.map((t) => t.id)).toEqual([
      'BUDGET_CAP',
      'VENUE_CAPACITY:venue',
      'GUEST_LOCK:catering',
      'PAYMENT:venue.second',
      'LEAD_TIME:catering',
    ]);
    expect(impact.after.tripwires.map((t) => t.status)).toEqual([
      'TRIPPED',
      'TRIPPED',
      'OK',
      'AT_RISK',
      'OK',
    ]);
    const leadTime = impact.after.tripwires.find((t) => t.id === 'LEAD_TIME:catering');
    expect(leadTime?.code).toBe('LEAD_TIME_OK');
    expect(leadTime?.facts).toEqual({ daysUntilEvent: 45, leadTimeDays: 7 });
    expect(impact.after.counts).toEqual({ OK: 2, AT_RISK: 1, NEEDS_VENDOR: 0, TRIPPED: 2 });
    expect(impact.after.worst).toBe('TRIPPED');

    const dMap = new Map(impact.tripwireDeltas.map((d) => [d.id, d]));
    expect(dMap.get('BUDGET_CAP')).toMatchObject({
      change: 'WORSENED',
      before: 'OK',
      after: 'TRIPPED',
    });
    expect(dMap.get('VENUE_CAPACITY:venue')).toMatchObject({
      change: 'WORSENED',
      before: 'OK',
      after: 'TRIPPED',
    });
    expect(dMap.get('GUEST_LOCK:catering')?.change).toBe('UNCHANGED');
    expect(dMap.get('PAYMENT:venue.second')?.change).toBe('UNCHANGED');
    expect(dMap.get('LEAD_TIME:catering')).toMatchObject({ change: 'NEW', after: 'OK' });

    expect(impact.escalations.map((t) => t.id)).toEqual(['BUDGET_CAP', 'VENUE_CAPACITY:venue']);
    expect(
      impact.paymentChanges.map((p) => ({
        vendorId: p.vendorId,
        milestoneId: p.milestoneId,
        fromDate: p.fromDate,
        toDate: p.toDate,
        fromAmount: p.fromAmount,
        toAmount: p.toAmount,
      })),
    ).toEqual([
      {
        vendorId: 'catering',
        milestoneId: 'second',
        fromDate: '2026-11-28',
        toDate: '2026-11-28',
        fromAmount: 6098400,
        toAmount: 8570100,
      },
      {
        vendorId: 'catering',
        milestoneId: 'final',
        fromDate: '2026-12-10',
        toDate: '2026-12-10',
        fromAmount: 4573800,
        toAmount: 6427575,
      },
    ]);
  });

  it('F. [VENDOR_PRICE_PCT catering/decor +1000]', () => {
    const impact = getImpact(weddingPlan, [
      { kind: 'VENDOR_PRICE_PCT', vendorId: 'catering', pctBp: 1000 },
    ]);
    expect(impact.planCostDelta).toBe(1524600);
    expect(impact.headroomDelta).toBe(-1524600);
    expect(impact.vendorCostDeltas).toEqual([
      {
        vendorId: 'catering',
        before: 15246000,
        after: 16770600,
        delta: 1524600,
        dropped: false,
        paidToDate: 4573800,
        remainingAfter: 12196800,
        trueUp: 457380,
      },
    ]);
    expect(impact.after.tripwires.map((t) => t.id)).toEqual([
      'BUDGET_CAP',
      'VENUE_CAPACITY:venue',
      'GUEST_LOCK:catering',
      'PAYMENT:venue.second',
      'LEAD_TIME:catering',
    ]);
    expect(impact.after.tripwires.map((t) => t.status)).toEqual([
      'AT_RISK',
      'OK',
      'OK',
      'AT_RISK',
      'OK',
    ]);
    expect(impact.after.counts).toEqual({ OK: 3, AT_RISK: 2, NEEDS_VENDOR: 0, TRIPPED: 0 });

    const dMap = new Map(impact.tripwireDeltas.map((d) => [d.id, d]));
    expect(dMap.get('BUDGET_CAP')).toMatchObject({
      change: 'WORSENED',
      before: 'OK',
      after: 'AT_RISK',
    });
    expect(dMap.get('LEAD_TIME:catering')?.change).toBe('NEW');
    expect(impact.escalations.map((t) => t.id)).toEqual(['BUDGET_CAP']);

    expect(
      impact.paymentChanges.map(
        (p) => `${p.vendorId}.${p.milestoneId} ${p.fromAmount} -> ${p.toAmount} (${p.fromDate})`,
      ),
    ).toEqual([
      'catering.second 6098400 -> 6708240 (2026-11-28)',
      'catering.final 4573800 -> 5031180 (2026-12-10)',
    ]);

    // decor +1000
    const impactDecor = getImpact(weddingPlan, [
      { kind: 'VENDOR_PRICE_PCT', vendorId: 'decor', pctBp: 1000 },
    ]);
    expect(impactDecor.planCostDelta).toBe(1888000);
    expect(impactDecor.vendorCostDeltas).toEqual([
      {
        vendorId: 'decor',
        before: 18880000,
        after: 20768000,
        delta: 1888000,
        dropped: false,
        paidToDate: 0,
        remainingAfter: 20768000,
        trueUp: 0,
      },
    ]);
    const ltDecor = impactDecor.after.tripwires.find((t) => t.id === 'LEAD_TIME:decor');
    expect(ltDecor).toMatchObject({
      status: 'OK',
      code: 'LEAD_TIME_OK',
      facts: { daysUntilEvent: 45, leadTimeDays: 21 },
    });
  });

  it('G. Multi-change [GUEST_COUNT_DELTA +50, BUDGET_CAP_PCT -1500]', () => {
    const impact = getImpact(weddingPlan, [
      { kind: 'GUEST_COUNT_DELTA', delta: 50 },
      { kind: 'BUDGET_CAP_PCT', pctBp: -1500 },
    ]);
    expect(impact.planCostDelta).toBe(6179250);
    expect(impact.headroomDelta).toBe(-16679250);
    const bCap = impact.after.tripwires.find((t) => t.id === 'BUDGET_CAP');
    expect(bCap?.facts).toEqual({
      total: 71955250,
      cap: 59500000,
      headroom: -12455250,
      overBy: 12455250,
    });
  });

  it('H. Improvement: start from after +50 guests, assess [GUEST_COUNT_SET to 120]', () => {
    const intermediate = applyChange(weddingPlan, { kind: 'GUEST_COUNT_DELTA', delta: 50 });
    if (!intermediate.ok) throw new Error('apply failed');
    const impact = getImpact(intermediate.plan, [{ kind: 'GUEST_COUNT_SET', to: 120 }]);

    expect(impact.planCostDelta).toBe(-6179250);
    expect(impact.headroomDelta).toBe(6179250);
    const dMap = new Map(impact.tripwireDeltas.map((d) => [d.id, d]));
    expect(dMap.get('BUDGET_CAP')).toMatchObject({
      change: 'IMPROVED',
      before: 'TRIPPED',
      after: 'OK',
    });
    expect(dMap.get('VENUE_CAPACITY:venue')).toMatchObject({
      change: 'IMPROVED',
      before: 'TRIPPED',
      after: 'OK',
    });
    expect(dMap.get('GUEST_LOCK:catering')?.change).toBe('UNCHANGED');
    expect(dMap.get('PAYMENT:venue.second')?.change).toBe('UNCHANGED');
    expect(impact.vendorCostDeltas).toEqual([
      {
        vendorId: 'catering',
        before: 21425250,
        after: 15246000,
        delta: -6179250,
        dropped: false,
        paidToDate: 6427575,
        remainingAfter: 8818425,
        trueUp: -1853775,
      },
    ]);
  });

  it('I. No-op [GUEST_COUNT_DELTA 0]', () => {
    const impact = getImpact(weddingPlan, [{ kind: 'GUEST_COUNT_DELTA', delta: 0 }]);
    expect(impact.planCostDelta).toBe(0);
    expect(impact.tripwireDeltas.every((d) => d.change === 'UNCHANGED')).toBe(true);
    expect(impact.escalations).toEqual([]);
    expect(impact.vendorCostDeltas).toEqual([]);
    expect(impact.paymentChanges).toEqual([]);
  });

  it('J. Errors: [DELTA -130] and [DELTA +1, VENDOR_DROP "nope"]', () => {
    const res1 = assessChange(weddingPlan, [{ kind: 'GUEST_COUNT_DELTA', delta: -130 }]);
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.error.code).toBe('NEGATIVE_GUESTS');
    }

    const res2 = assessChange(weddingPlan, [
      { kind: 'GUEST_COUNT_DELTA', delta: 1 },
      { kind: 'VENDOR_DROP', vendorId: 'nope' },
    ]);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.code).toBe('VENDOR_NOT_FOUND');
      expect(res2.error.changeIndex).toBe(1);
    }
  });

  it('K. before in the result deep-equals evaluatePlan(plan)', () => {
    const expected = evaluatePlan(weddingPlan);
    const impact = getImpact(weddingPlan, [{ kind: 'GUEST_COUNT_DELTA', delta: 10 }]);
    expect(impact.before).toEqual(expected);
  });

  it('L. Properties (fast-check) for each fixture with guest delta in [-50, 200]', () => {
    const fixtures = [weddingPlan, birthdayPlan, communityPlan];
    fc.assert(
      fc.property(
        fc.constantFrom(...fixtures),
        fc.integer({ min: -50, max: 200 }),
        (plan, delta) => {
          let res: ReturnType<typeof assessChange>;
          expect(() => {
            res = assessChange(deepFreeze(structuredClone(plan)), [
              { kind: 'GUEST_COUNT_DELTA', delta },
            ]);
          }).not.toThrow();

          if (res!.ok) {
            const { impact } = res!;
            expect(impact.planCostDelta).toBe(impact.after.cost.total - impact.before.cost.total);
            const sumDelta = impact.vendorCostDeltas.reduce((acc, v) => acc + v.delta, 0);
            expect(sumDelta).toBe(impact.planCostDelta);
            const countsSum = Object.values(impact.after.counts).reduce((a, b) => a + b, 0);
            expect(countsSum).toBe(impact.after.tripwires.length);
            const ids = impact.after.tripwires.map((t) => t.id);
            expect(new Set(ids).size).toBe(ids.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
