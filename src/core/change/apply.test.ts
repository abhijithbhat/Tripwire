import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computePlanCost, computeVendorCost } from '../cost/plan-cost';
import { validatePlan } from '../domain/validate';
import { birthdayPlan } from '../fixtures/birthday-40';
import { communityPlan } from '../fixtures/community-300';
import { weddingPlan } from '../fixtures/wedding-120';
import { deepFreeze } from '../test-utils/deep-freeze';
import { applyChange, applyChanges } from './apply';
import { parseChangeSet } from './schema';

describe('parseChangeSet', () => {
  it('parses a valid two-change set', () => {
    const input = {
      changes: [
        { kind: 'GUEST_COUNT_SET', to: 150 },
        { kind: 'BUDGET_CAP_PCT', pctBp: 500 },
      ],
    };
    const res = parseChangeSet(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.changes).toEqual(input.changes);
    }
  });

  it('rejects unknown kind', () => {
    const res = parseChangeSet({ changes: [{ kind: 'UNKNOWN_KIND', to: 10 }] });
    expect(res.ok).toBe(false);
  });

  it('rejects extra keys in change objects', () => {
    const res = parseChangeSet({
      changes: [{ kind: 'GUEST_COUNT_SET', to: 100, note: 'x' }],
    });
    expect(res.ok).toBe(false);
  });

  it('rejects empty changes array', () => {
    const res = parseChangeSet({ changes: [] });
    expect(res.ok).toBe(false);
  });

  it('rejects more than 5 changes', () => {
    const changes = Array.from({ length: 6 }, () => ({
      kind: 'GUEST_COUNT_SET',
      to: 100,
    }));
    const res = parseChangeSet({ changes });
    expect(res.ok).toBe(false);
  });

  it('rejects non-integer to value', () => {
    const res = parseChangeSet({
      changes: [{ kind: 'GUEST_COUNT_SET', to: 1.5 }],
    });
    expect(res.ok).toBe(false);
  });

  it('rejects invalid calendar date in EVENT_DATE_MOVE', () => {
    const res = parseChangeSet({
      changes: [{ kind: 'EVENT_DATE_MOVE', to: '2026-02-30' }],
    });
    expect(res.ok).toBe(false);
  });

  it('formats issue path as dot-joined string', () => {
    const res = parseChangeSet({
      changes: [{ kind: 'GUEST_COUNT_SET', to: -1 }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues[0]?.path).toBe('changes.0.to');
    }
  });
});

describe('applyChange - guest count', () => {
  it('SET 170 updates guestCount and keeps other fields deep-equal', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'GUEST_COUNT_SET', to: 170 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.guestCount).toBe(170);
      const { guestCount: _g1, ...origRest } = input;
      const { guestCount: _g2, ...newRest } = res.plan;
      expect(newRest).toEqual(origRest);
    }
  });

  it('DELTA +50 updates guestCount to 170', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'GUEST_COUNT_DELTA', delta: 50 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.guestCount).toBe(170);
    }
  });

  it('DELTA -130 returns NEGATIVE_GUESTS', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'GUEST_COUNT_DELTA', delta: -130 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('NEGATIVE_GUESTS');
    }
  });

  it('DELTA -120 updates guestCount to 0 (ok)', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'GUEST_COUNT_DELTA', delta: -120 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.guestCount).toBe(0);
    }
  });
});

describe('applyChange - budget cap', () => {
  it('SET 80000000 sets budgetCap', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'BUDGET_CAP_SET', to: 80_000_000 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.budgetCap).toBe(80_000_000);
    }
  });

  it('PCT -1500 updates cap to 59500000', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'BUDGET_CAP_PCT', pctBp: -1500 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.budgetCap).toBe(59_500_000);
    }
  });

  it('PCT +1000 updates cap to 77000000', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'BUDGET_CAP_PCT', pctBp: 1000 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.budgetCap).toBe(77_000_000);
    }
  });

  it('PCT -9999 updates cap to 7000 (ok)', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'BUDGET_CAP_PCT', pctBp: -9999 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.budgetCap).toBe(7000);
    }
  });

  it('returns INVALID_BUDGET if PCT causes budget to drop below 1', () => {
    const input = deepFreeze(structuredClone({ ...weddingPlan, budgetCap: 1 }));
    const res = applyChange(input, { kind: 'BUDGET_CAP_PCT', pctBp: -9999 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_BUDGET');
    }
  });
});

describe('applyChange - event date move', () => {
  it('MOVE to 2026-11-22 updates eventDate without assuming catering guarantee', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'EVENT_DATE_MOVE', to: '2026-11-22' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.eventDate).toBe('2026-11-22');
      const catering = res.plan.vendors.find((v) => v.id === 'catering');
      expect(catering?.lock?.guaranteedGuests).toBeUndefined();
      expect(res.assumptions).toEqual([]);
      expect(validatePlan(res.plan).ok).toBe(true);
    }
  });

  it('MOVE to 2026-11-01 assumes catering guarantee of 120 guests', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'EVENT_DATE_MOVE', to: '2026-11-01' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.eventDate).toBe('2026-11-01');
      const catering = res.plan.vendors.find((v) => v.id === 'catering');
      expect(catering?.lock?.guaranteedGuests).toBe(120);
      expect(res.assumptions).toEqual([
        { code: 'GUARANTEE_ASSUMED', vendorId: 'catering', guests: 120 },
      ]);
      expect(validatePlan(res.plan).ok).toBe(true);
    }
  });

  it('MOVE to 2026-10-27 returns DATE_BEFORE_AS_OF', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'EVENT_DATE_MOVE', to: '2026-10-27' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('DATE_BEFORE_AS_OF');
    }
  });
});

describe('applyChange - vendor drop', () => {
  it('drops venue and computes expected plan cost', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'VENDOR_DROP', vendorId: 'venue' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const venue = res.plan.vendors.find((v) => v.id === 'venue');
      expect(venue?.status).toBe('DROPPED');
      expect(computePlanCost(res.plan).total).toBe(45_126_000);
    }
  });

  it('returns VENDOR_NOT_FOUND for unknown vendor id', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'VENDOR_DROP', vendorId: 'nope' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VENDOR_NOT_FOUND');
    }
  });

  it('returns VENDOR_NOT_ACTIVE when dropping a vendor twice with applyChanges', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChanges(input, [
      { kind: 'VENDOR_DROP', vendorId: 'venue' },
      { kind: 'VENDOR_DROP', vendorId: 'venue' },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VENDOR_NOT_ACTIVE');
      expect(res.error.changeIndex).toBe(1);
    }
  });
});

describe('applyChange - vendor price pct', () => {
  it('wedding catering PCT +1000 updates plate/staff rates and totals', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, {
      kind: 'VENDOR_PRICE_PCT',
      vendorId: 'catering',
      pctBp: 1000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const catering = res.plan.vendors.find((v) => v.id === 'catering')!;
      const plates = catering.costRules.find((r) => r.id === 'plates')!;
      const staff = catering.costRules.find((r) => r.id === 'staff')!;
      const sc = catering.costRules.find((r) => r.id === 'service-charge')!;
      const gst = catering.costRules.find((r) => r.id === 'gst')!;

      if (plates.kind === 'PER_GUEST') expect(plates.unitAmount).toBe(104500);
      if (staff.kind === 'STEP') expect(staff.unitAmount).toBe(660000);
      if (sc.kind === 'SURCHARGE_PCT') expect(sc.pctBp).toBe(1000);
      if (gst.kind === 'SURCHARGE_PCT') expect(gst.pctBp).toBe(500);

      expect(computeVendorCost(catering, res.plan).total).toBe(16770600);
      expect(computePlanCost(res.plan).total).toBe(67300600);
    }
  });

  it('wedding venue PCT -500 updates venue and plan totals', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, {
      kind: 'VENDOR_PRICE_PCT',
      vendorId: 'venue',
      pctBp: -500,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const venue = res.plan.vendors.find((v) => v.id === 'venue')!;
      expect(computeVendorCost(venue, res.plan).total).toBe(19617500);
      expect(computePlanCost(res.plan).total).toBe(64743500);
    }
  });

  it('birthday catering PCT +1000 updates tiers and totals', () => {
    const input = deepFreeze(structuredClone(birthdayPlan));
    const res = applyChange(input, {
      kind: 'VENDOR_PRICE_PCT',
      vendorId: 'catering',
      pctBp: 1000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const catering = res.plan.vendors.find((v) => v.id === 'catering')!;
      const pizza = catering.costRules.find((r) => r.id === 'pizza')!;
      if (pizza.kind === 'PER_GUEST_TIERED') {
        expect(pizza.tiers.map((t) => t.unitAmount)).toEqual([1760, 1540, 1320]);
        expect(pizza.minBillableGuests).toBe(20);
      }
      expect(computeVendorCost(catering, res.plan).total).toBe(65912);
      expect(computePlanCost(res.plan).total).toBe(113912);
    }
  });

  it('returns VENDOR_NOT_FOUND if vendor does not exist', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'VENDOR_PRICE_PCT', vendorId: 'nope', pctBp: 500 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('VENDOR_NOT_FOUND');
  });

  it('returns VENDOR_NOT_ACTIVE if vendor is dropped', () => {
    const droppedPlan = structuredClone(weddingPlan);
    droppedPlan.vendors[0]!.status = 'DROPPED';
    const input = deepFreeze(droppedPlan);
    const res = applyChange(input, { kind: 'VENDOR_PRICE_PCT', vendorId: 'venue', pctBp: 500 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('VENDOR_NOT_ACTIVE');
  });

  it('returns INVALID_RESULT if resulting plan fails validation', () => {
    const invalidPlan = structuredClone(weddingPlan);
    invalidPlan.vendors[0]!.paymentSchedule.push({
      id: 'deposit',
      label: 'Duplicate',
      pctBp: 0,
      dueOffsetDays: 0,
      paid: false,
    });
    const input = deepFreeze(invalidPlan);
    const res = applyChange(input, { kind: 'GUEST_COUNT_SET', to: 100 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_RESULT');
      expect(res.error.message).toContain('DUPLICATE_MILESTONE_ID');
    }
  });
});

describe('cross-module interactions', () => {
  it('wedding DELTA +50 updates catering and plan totals', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChange(input, { kind: 'GUEST_COUNT_DELTA', delta: 50 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const catering = res.plan.vendors.find((v) => v.id === 'catering')!;
      expect(computeVendorCost(catering, res.plan).total).toBe(21425250);
      expect(computePlanCost(res.plan).total).toBe(71955250);
    }
  });

  it('applyChanges with DELTA +50 and BUDGET_CAP_PCT -1500 produces expected state', () => {
    const input = deepFreeze(structuredClone(weddingPlan));
    const res = applyChanges(input, [
      { kind: 'GUEST_COUNT_DELTA', delta: 50 },
      { kind: 'BUDGET_CAP_PCT', pctBp: -1500 },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.guestCount).toBe(170);
      expect(res.plan.budgetCap).toBe(59500000);
      expect(computePlanCost(res.plan).total).toBe(71955250);
    }
  });
});

describe('property invariants (fast-check)', () => {
  it('preserves invariants for guest deltas [-200, 200]', () => {
    const fixtures = [weddingPlan, birthdayPlan, communityPlan];
    for (const fixture of fixtures) {
      fc.assert(
        fc.property(fc.integer({ min: -200, max: 200 }), (delta) => {
          const input = deepFreeze(structuredClone(fixture));
          const res = applyChange(input, { kind: 'GUEST_COUNT_DELTA', delta });
          if (res.ok) {
            expect(validatePlan(res.plan).ok).toBe(true);
          } else {
            expect(res.error.code).toBe('NEGATIVE_GUESTS');
            expect(fixture.guestCount + delta).toBeLessThan(0);
          }
        }),
      );
    }
  });
});
