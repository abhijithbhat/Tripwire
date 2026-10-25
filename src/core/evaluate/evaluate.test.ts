import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyChange } from '../change/apply';
import type { Change } from '../change/schema';
import type { Plan } from '../domain/schema';
import { birthdayPlan } from '../fixtures/birthday-40';
import { communityPlan } from '../fixtures/community-300';
import { weddingPlan } from '../fixtures/wedding-120';
import { deepFreeze } from '../test-utils/deep-freeze';
import { evaluatePlan, worstStatus } from './evaluate';
import { STATUS_SEVERITY, type FactValue, type TripwireStatus } from './types';

function makePaidPlan(base: Plan): Plan {
  return {
    ...base,
    vendors: base.vendors.map((v) => ({
      ...v,
      paymentSchedule: v.paymentSchedule.map((m) => ({ ...m, paid: true })),
    })),
  };
}

function applyWedding(change: Change): Plan {
  const res = applyChange(weddingPlan, change);
  if (!res.ok) throw new Error(`apply failed: ${res.error.code}`);
  return res.plan;
}

describe('evaluatePlan baselines (asOf 2026-10-28)', () => {
  it('evaluates wedding baseline correctly', () => {
    const ev = evaluatePlan(deepFreeze(structuredClone(weddingPlan)));
    expect(ev.tripwires).toEqual([
      {
        id: 'BUDGET_CAP',
        kind: 'BUDGET_CAP',
        status: 'OK',
        code: 'WITHIN_BUDGET',
        facts: { total: 65776000, cap: 70000000, headroom: 4224000 },
      },
      {
        id: 'VENUE_CAPACITY:venue',
        kind: 'VENUE_CAPACITY',
        status: 'OK',
        code: 'WITHIN_CAPACITY',
        vendorId: 'venue',
        facts: { guests: 120, capacity: 150, free: 30 },
      },
      {
        id: 'GUEST_LOCK:catering',
        kind: 'GUEST_LOCK',
        status: 'OK',
        code: 'LOCK_NOT_REACHED',
        vendorId: 'catering',
        facts: { daysToLock: 31, lockDate: '2026-11-28' },
      },
      {
        id: 'PAYMENT:venue.second',
        kind: 'PAYMENT',
        status: 'AT_RISK',
        code: 'PAYMENT_DUE_TODAY',
        vendorId: 'venue',
        facts: { amount: 10325000, dueDate: '2026-10-28' },
      },
    ]);
    expect(ev.counts).toEqual({ OK: 3, AT_RISK: 1, NEEDS_VENDOR: 0, TRIPPED: 0 });
    expect(ev.worst).toBe('AT_RISK');
  });

  it('evaluates birthday baseline correctly', () => {
    const ev = evaluatePlan(deepFreeze(structuredClone(birthdayPlan)));
    expect(ev.tripwires.map((t) => [t.id, t.status, t.code])).toEqual([
      ['BUDGET_CAP', 'OK', 'WITHIN_BUDGET'],
      ['VENUE_CAPACITY:venue', 'OK', 'WITHIN_CAPACITY'],
      ['GUEST_LOCK:catering', 'OK', 'LOCK_NOT_REACHED'],
    ]);
    expect(ev.tripwires[0]!.facts).toEqual({ total: 107920, cap: 120000, headroom: 12080 });
    expect(ev.tripwires[1]!.facts).toEqual({ guests: 40, capacity: 50, free: 10 });
    expect(ev.tripwires[2]!.facts).toEqual({ daysToLock: 17, lockDate: '2026-11-14' });
    expect(ev.counts).toEqual({ OK: 3, AT_RISK: 0, NEEDS_VENDOR: 0, TRIPPED: 0 });
    expect(ev.worst).toBe('OK');
  });

  it('evaluates community baseline correctly', () => {
    const ev = evaluatePlan(deepFreeze(structuredClone(communityPlan)));
    expect(ev.tripwires.map((t) => [t.id, t.status, t.code])).toEqual([
      ['BUDGET_CAP', 'OK', 'WITHIN_BUDGET'],
      ['VENUE_CAPACITY:grounds', 'OK', 'WITHIN_CAPACITY'],
      ['GUEST_LOCK:kitchen', 'OK', 'LOCK_NOT_REACHED'],
    ]);
    expect(ev.tripwires[0]!.facts).toEqual({ total: 12630000, cap: 15000000, headroom: 2370000 });
    expect(ev.tripwires[1]!.facts).toEqual({ guests: 300, capacity: 350, free: 50 });
    expect(ev.tripwires[2]!.facts).toEqual({ daysToLock: 12, lockDate: '2026-11-09' });
    expect(ev.counts).toEqual({ OK: 3, AT_RISK: 0, NEEDS_VENDOR: 0, TRIPPED: 0 });
    expect(ev.worst).toBe('OK');
  });
});

describe('evaluatePlan wedding scenarios', () => {
  it('handles GUEST_COUNT_DELTA +50', () => {
    const ev = evaluatePlan(
      deepFreeze(structuredClone(applyWedding({ kind: 'GUEST_COUNT_DELTA', delta: 50 }))),
    );
    expect(ev.tripwires[0]).toEqual({
      id: 'BUDGET_CAP',
      kind: 'BUDGET_CAP',
      status: 'TRIPPED',
      code: 'OVER_BUDGET',
      facts: { total: 71955250, cap: 70000000, headroom: -1955250, overBy: 1955250 },
    });
    expect(ev.tripwires[1]).toEqual({
      id: 'VENUE_CAPACITY:venue',
      kind: 'VENUE_CAPACITY',
      status: 'TRIPPED',
      code: 'OVER_CAPACITY',
      vendorId: 'venue',
      facts: { guests: 170, capacity: 150, over: 20 },
    });
    expect(ev.tripwires[2]!.status).toBe('OK');
    expect(ev.tripwires[3]!.status).toBe('AT_RISK');
    expect(ev.counts).toEqual({ OK: 1, AT_RISK: 1, NEEDS_VENDOR: 0, TRIPPED: 2 });
    expect(ev.worst).toBe('TRIPPED');
  });

  it('handles GUEST_COUNT_DELTA +20', () => {
    const ev = evaluatePlan(
      deepFreeze(structuredClone(applyWedding({ kind: 'GUEST_COUNT_DELTA', delta: 20 }))),
    );
    expect(ev.tripwires[0]).toEqual({
      id: 'BUDGET_CAP',
      kind: 'BUDGET_CAP',
      status: 'AT_RISK',
      code: 'NEAR_BUDGET',
      facts: { total: 67970500, cap: 70000000, headroom: 2029500 },
    });
    expect(ev.tripwires[1]).toEqual({
      id: 'VENUE_CAPACITY:venue',
      kind: 'VENUE_CAPACITY',
      status: 'AT_RISK',
      code: 'NEAR_CAPACITY',
      vendorId: 'venue',
      facts: { guests: 140, capacity: 150, free: 10 },
    });
    expect(ev.counts).toEqual({ OK: 1, AT_RISK: 3, NEEDS_VENDOR: 0, TRIPPED: 0 });
  });

  it('handles BUDGET_CAP_PCT -1500', () => {
    const ev = evaluatePlan(
      deepFreeze(structuredClone(applyWedding({ kind: 'BUDGET_CAP_PCT', pctBp: -1500 }))),
    );
    expect(ev.tripwires[0]).toEqual({
      id: 'BUDGET_CAP',
      kind: 'BUDGET_CAP',
      status: 'TRIPPED',
      code: 'OVER_BUDGET',
      facts: { total: 65776000, cap: 59500000, headroom: -6276000, overBy: 6276000 },
    });
    expect(ev.counts).toEqual({ OK: 2, AT_RISK: 1, NEEDS_VENDOR: 0, TRIPPED: 1 });
  });

  it('handles VENDOR_PRICE_PCT catering +1000', () => {
    const ev = evaluatePlan(
      deepFreeze(
        structuredClone(
          applyWedding({ kind: 'VENDOR_PRICE_PCT', vendorId: 'catering', pctBp: 1000 }),
        ),
      ),
    );
    expect(ev.tripwires[0]).toEqual({
      id: 'BUDGET_CAP',
      kind: 'BUDGET_CAP',
      status: 'AT_RISK',
      code: 'NEAR_BUDGET',
      facts: { total: 67300600, cap: 70000000, headroom: 2699400 },
    });
    expect(ev.counts).toEqual({ OK: 2, AT_RISK: 2, NEEDS_VENDOR: 0, TRIPPED: 0 });
  });

  it('handles VENDOR_DROP venue', () => {
    const ev = evaluatePlan(
      deepFreeze(structuredClone(applyWedding({ kind: 'VENDOR_DROP', vendorId: 'venue' }))),
    );
    expect(ev.tripwires).toEqual([
      {
        id: 'BUDGET_CAP',
        kind: 'BUDGET_CAP',
        status: 'OK',
        code: 'WITHIN_BUDGET',
        facts: { total: 45126000, cap: 70000000, headroom: 24874000 },
      },
      {
        id: 'VENUE_PRESENT',
        kind: 'VENUE_PRESENT',
        status: 'TRIPPED',
        code: 'NO_VENUE',
        facts: {},
      },
      {
        id: 'GUEST_LOCK:catering',
        kind: 'GUEST_LOCK',
        status: 'OK',
        code: 'LOCK_NOT_REACHED',
        vendorId: 'catering',
        facts: { daysToLock: 31, lockDate: '2026-11-28' },
      },
    ]);
    expect(ev.counts).toEqual({ OK: 2, AT_RISK: 0, NEEDS_VENDOR: 0, TRIPPED: 1 });
    expect(ev.worst).toBe('TRIPPED');
  });

  it('handles overdue payment with asOfDate 2026-11-05', () => {
    const plan = { ...weddingPlan, asOfDate: '2026-11-05' };
    const ev = evaluatePlan(deepFreeze(structuredClone(plan)));
    expect(ev.tripwires[3]).toEqual({
      id: 'PAYMENT:venue.second',
      kind: 'PAYMENT',
      status: 'TRIPPED',
      code: 'PAYMENT_OVERDUE',
      vendorId: 'venue',
      facts: { amount: 10325000, dueDate: '2026-10-28', daysOverdue: 8 },
    });
    expect(ev.counts).toEqual({ OK: 3, AT_RISK: 0, NEEDS_VENDOR: 0, TRIPPED: 1 });
  });
});

describe('evaluatePlan lock variants (L1 - L8)', () => {
  const basePaid = makePaidPlan(weddingPlan);

  const setCatLock = (p: Plan, asOf: string, guests: number, g = 120) => {
    p.asOfDate = asOf;
    p.guestCount = guests;
    p.vendors.find((v) => v.id === 'catering')!.lock!.guaranteedGuests = g;
  };

  const lockCases: Array<{
    name: string;
    modify: (p: Plan) => void;
    status: TripwireStatus;
    code: string;
    facts: Record<string, FactValue>;
  }> = [
    {
      name: 'L1',
      modify: (p) => {
        p.asOfDate = '2026-11-27';
      },
      status: 'AT_RISK',
      code: 'LOCK_SOON',
      facts: { daysToLock: 1, lockDate: '2026-11-28' },
    },
    {
      name: 'L2',
      modify: (p) => setCatLock(p, '2026-11-28', 120),
      status: 'OK',
      code: 'LOCK_MATCHES',
      facts: { guaranteed: 120, guests: 120 },
    },
    {
      name: 'L3',
      modify: (p) => setCatLock(p, '2026-11-29', 100),
      status: 'TRIPPED',
      code: 'REDUCTION_NOT_REFUNDABLE',
      facts: { guaranteed: 120, guests: 100, paidForUnused: 20, wastedCost: 2194500 },
    },
    {
      name: 'L4',
      modify: (p) => {
        setCatLock(p, '2026-11-29', 100);
        p.vendors.find((v) => v.id === 'catering')!.lock!.reductionsAllowedAfterLock = true;
      },
      status: 'OK',
      code: 'LOCK_REDUCTION_ALLOWED',
      facts: { guaranteed: 120, guests: 100 },
    },
    {
      name: 'L5',
      modify: (p) => setCatLock(p, '2026-11-29', 130),
      status: 'AT_RISK',
      code: 'LATE_INCREASE_WITHIN_TOLERANCE',
      facts: { extra: 10, maxExtra: 12, deadline: '2026-12-09' },
    },
    {
      name: 'L6',
      modify: (p) => setCatLock(p, '2026-11-29', 140),
      status: 'NEEDS_VENDOR',
      code: 'INCREASE_NEEDS_APPROVAL',
      facts: { extra: 20, maxExtra: 12, windowOpen: true, deadline: '2026-12-09' },
    },
    {
      name: 'L7',
      modify: (p) => setCatLock(p, '2026-12-10', 130),
      status: 'NEEDS_VENDOR',
      code: 'INCREASE_NEEDS_APPROVAL',
      facts: { extra: 10, maxExtra: 12, windowOpen: false, deadline: '2026-12-09' },
    },
    {
      name: 'L8',
      modify: (p) => {
        setCatLock(p, '2026-11-29', 130);
        const l = p.vendors.find((v) => v.id === 'catering')!.lock!;
        l.increaseAllowedUntilOffsetDays = undefined;
        l.increaseTolerancePctBp = undefined;
      },
      status: 'NEEDS_VENDOR',
      code: 'INCREASE_NEEDS_APPROVAL',
      facts: { extra: 10, maxExtra: 0, windowOpen: false },
    },
  ];

  for (const c of lockCases) {
    it(`evaluates lock variant ${c.name}`, () => {
      const plan = structuredClone(basePaid);
      c.modify(plan);
      const ev = evaluatePlan(deepFreeze(structuredClone(plan)));
      const tw = ev.tripwires.find((t) => t.id === 'GUEST_LOCK:catering');
      expect(tw).toEqual({
        id: 'GUEST_LOCK:catering',
        kind: 'GUEST_LOCK',
        status: c.status,
        code: c.code,
        vendorId: 'catering',
        facts: c.facts,
      });
    });
  }

  it('evaluates active lock when guaranteedGuests is undefined', () => {
    const p = structuredClone(basePaid);
    p.asOfDate = '2026-11-28';
    p.guestCount = 120;
    p.vendors.find((v) => v.id === 'catering')!.lock!.guaranteedGuests = undefined;
    const ev = evaluatePlan(deepFreeze(structuredClone(p)));
    const tw = ev.tripwires.find((t) => t.id === 'GUEST_LOCK:catering');
    expect(tw).toEqual({
      id: 'GUEST_LOCK:catering',
      kind: 'GUEST_LOCK',
      status: 'OK',
      code: 'LOCK_MATCHES',
      vendorId: 'catering',
      facts: { guaranteed: 120, guests: 120 },
    });
  });
});

describe('evaluatePlan invariants & general tests', () => {
  it('omits VENUE_PRESENT tripwire when plan has no VENUE vendor', () => {
    const noVenue = structuredClone(weddingPlan);
    noVenue.vendors = noVenue.vendors.filter((v) => v.category !== 'VENUE');
    const ev = evaluatePlan(deepFreeze(noVenue));
    expect(ev.tripwires.some((t) => t.id === 'VENUE_PRESENT')).toBe(false);
  });

  it('generates unique tripwire IDs', () => {
    const ev = evaluatePlan(deepFreeze(structuredClone(weddingPlan)));
    const ids = ev.tripwires.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is purely functional and deterministic', () => {
    const p1 = deepFreeze(structuredClone(weddingPlan));
    const p2 = structuredClone(weddingPlan);
    expect(evaluatePlan(p1)).toEqual(evaluatePlan(p2));
  });

  it('worstStatus returns OK for empty list', () => {
    expect(worstStatus([])).toBe('OK');
  });

  it('satisfies fast-check property invariants', () => {
    for (const plan of [weddingPlan, birthdayPlan, communityPlan]) {
      const ev = evaluatePlan(plan);
      const total = ev.counts.OK + ev.counts.AT_RISK + ev.counts.NEEDS_VENDOR + ev.counts.TRIPPED;
      expect(total).toBe(ev.tripwires.length);
      const maxSev = Math.max(...ev.tripwires.map((t) => STATUS_SEVERITY[t.status]), 0);
      expect(STATUS_SEVERITY[ev.worst]).toBe(maxSev);
    }

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), (guestCount) => {
        const testPlan = deepFreeze(structuredClone({ ...communityPlan, guestCount }));
        const ev = evaluatePlan(testPlan);
        const budgetTw = ev.tripwires.find((t) => t.id === 'BUDGET_CAP')!;
        const headroom = budgetTw.facts['headroom'] as number;
        expect(budgetTw.status === 'TRIPPED').toBe(headroom < 0);
      }),
    );
  });
});
