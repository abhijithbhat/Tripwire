import { describe, expect, it } from 'vitest';
import {
  cancel,
  flat,
  makePlan,
  makeVendor,
  milestone,
  rupees,
  surcharge,
  tiered,
} from '../fixtures/builders';
import { validatePlan } from './validate';

describe('validatePlan', () => {
  const baseVendor = makeVendor({
    id: 'venue-1',
    name: 'Palace',
    category: 'VENUE',
    costRules: [flat('r-1', 'Rental', rupees(50_000))],
  });

  it('passes a minimal builder plan', () => {
    const plan = makePlan({ vendors: [baseVendor] });
    const result = validatePlan(plan);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.id).toBe('test-plan');
    }
  });

  it('rejects non-object and empty inputs without throwing', () => {
    for (const input of [null, 42, 'x', {}, []]) {
      const res = validatePlan(input);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.length).toBeGreaterThan(0);
        expect(res.issues[0]?.code).toBe('SCHEMA');
      }
    }
  });

  it('reports SCHEMA issue for invalid calendar eventDate', () => {
    const plan = makePlan({ vendors: [baseVendor], eventDate: '2026-02-30' });
    const res = validatePlan(plan);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const issue = res.issues.find((i) => i.path === 'eventDate');
      expect(issue).toBeDefined();
      expect(issue?.code).toBe('SCHEMA');
    }
  });

  describe('semantic validations (one test per code)', () => {
    it('catches DUPLICATE_VENDOR_ID', () => {
      const plan = makePlan({ vendors: [baseVendor, { ...baseVendor }] });
      const res = validatePlan(plan);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'DUPLICATE_VENDOR_ID')).toBe(true);
      }
    });

    it('catches DUPLICATE_RULE_ID', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('dup-r', 'R1', 100), flat('dup-r', 'R2', 200)],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'DUPLICATE_RULE_ID')).toBe(true);
      }
    });

    it('catches DUPLICATE_MILESTONE_ID', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('r1', 'R1', 100)],
        paymentSchedule: [
          milestone('m1', 'A', 5000, 14, false),
          milestone('m1', 'B', 5000, 7, false),
        ],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'DUPLICATE_MILESTONE_ID')).toBe(true);
      }
    });

    it('catches DUPLICATE_OPTION_ID', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('r1', 'R1', 100)],
        options: [
          { id: 'opt-1', label: 'Opt A', switchFee: 0, costRules: [flat('r2', 'R2', 100)] },
          { id: 'opt-1', label: 'Opt B', switchFee: 0, costRules: [flat('r3', 'R3', 100)] },
        ],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'DUPLICATE_OPTION_ID')).toBe(true);
      }
    });

    it('catches AS_OF_AFTER_EVENT', () => {
      const plan = makePlan({
        vendors: [baseVendor],
        eventDate: '2026-12-12',
        asOfDate: '2026-12-13',
      });
      const res = validatePlan(plan);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'AS_OF_AFTER_EVENT')).toBe(true);
      }
    });

    it('catches BUDGET_ZERO', () => {
      const plan = makePlan({ vendors: [baseVendor], budgetCap: 0 });
      const res = validatePlan(plan);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'BUDGET_ZERO')).toBe(true);
      }
    });

    it('catches PAYMENT_PCT_SUM', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('r1', 'R1', 100)],
        paymentSchedule: [milestone('m1', 'Deposit', 8000, 7, false)],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'PAYMENT_PCT_SUM')).toBe(true);
      }
    });

    it('catches CANCELLATION_NO_ZERO_TIER', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('r1', 'R1', 100)],
        cancellation: [cancel(30, 5000)],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'CANCELLATION_NO_ZERO_TIER')).toBe(true);
      }
    });

    it('catches CANCELLATION_DUPLICATE_TIER', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('r1', 'R1', 100)],
        cancellation: [cancel(0, 10_000), cancel(0, 5000)],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'CANCELLATION_DUPLICATE_TIER')).toBe(true);
      }
    });

    it('catches CANCELLATION_PCT_RANGE', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('r1', 'R1', 100)],
        cancellation: [cancel(0, 12_000)],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'CANCELLATION_PCT_RANGE')).toBe(true);
      }
    });

    it('catches TIER_ORDER', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [
          tiered('t1', 'Tiered', [
            { fromGuests: 50, unitAmount: 1000 },
            { fromGuests: 0, unitAmount: 1200 },
          ]),
        ],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'TIER_ORDER')).toBe(true);
      }

      const v2 = makeVendor({
        id: 'v2',
        name: 'V2',
        category: 'VENUE',
        costRules: [
          tiered('t2', 'Tiered', [
            { fromGuests: 0, unitAmount: 1000 },
            { fromGuests: 50, unitAmount: 800 },
            { fromGuests: 40, unitAmount: 600 },
          ]),
        ],
      });
      const res2 = validatePlan(makePlan({ vendors: [v2] }));
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.issues.some((i) => i.code === 'TIER_ORDER')).toBe(true);
      }
    });

    it('catches SURCHARGE_ORDER', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [
          surcharge('s1', 'Service Tax', 1800, 'BASE_ONLY'),
          flat('f1', 'Late Addon', 5000),
        ],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'SURCHARGE_ORDER')).toBe(true);
      }
    });

    it('catches LOCK_WINDOW', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('r1', 'R1', 100)],
        lock: {
          lockOffsetDays: 14,
          reductionsAllowedAfterLock: false,
          increaseAllowedUntilOffsetDays: 20,
        },
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'LOCK_WINDOW')).toBe(true);
      }
    });

    it('catches LOCK_GUARANTEE_REQUIRED', () => {
      const v = makeVendor({
        id: 'v1',
        name: 'V',
        category: 'VENUE',
        costRules: [flat('r1', 'R1', 100)],
        lock: {
          lockOffsetDays: 14,
          reductionsAllowedAfterLock: false,
        },
      });
      // eventDate 2026-12-12, lockOffsetDays 14 => lock deadline 2026-11-28.
      // asOfDate 2026-11-28 is on the deadline without guaranteedGuests
      const plan = makePlan({
        vendors: [v],
        eventDate: '2026-12-12',
        asOfDate: '2026-11-28',
      });
      const res = validatePlan(plan);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'LOCK_GUARANTEE_REQUIRED')).toBe(true);
      }
    });

    it('catches CAPACITY_NON_VENUE', () => {
      const v = makeVendor({
        id: 'c1',
        name: 'Caterer',
        category: 'CATERING',
        capacity: 150,
        costRules: [flat('r1', 'R1', 100)],
      });
      const res = validatePlan(makePlan({ vendors: [v] }));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues.some((i) => i.code === 'CAPACITY_NON_VENUE')).toBe(true);
      }
    });
  });

  it('returns multiple issues when multiple violations exist', () => {
    const plan = makePlan({
      vendors: [baseVendor],
      budgetCap: 0, // BUDGET_ZERO
      asOfDate: '2026-12-13', // AS_OF_AFTER_EVENT
      eventDate: '2026-12-12',
    });
    const res = validatePlan(plan);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues.length).toBe(2);
      expect(res.issues.map((i) => i.code).sort()).toEqual(
        ['AS_OF_AFTER_EVENT', 'BUDGET_ZERO'].sort(),
      );
    }
  });

  it('leaves input object deep-equal before and after validation', () => {
    const plan = makePlan({ vendors: [baseVendor] });
    const originalJson = JSON.stringify(plan);
    validatePlan(plan);
    expect(JSON.stringify(plan)).toBe(originalJson);
  });
});
