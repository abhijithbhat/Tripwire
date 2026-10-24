import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CostRule, Plan, Vendor } from '../domain/schema';
import { birthdayPlan } from '../fixtures/birthday-40';
import { flat, perGuest, step, surcharge, tiered } from '../fixtures/builders';
import { communityPlan } from '../fixtures/community-300';
import { GOLDEN } from '../fixtures/golden';
import { weddingPlan } from '../fixtures/wedding-120';
import { billableGuestsFor, computePlanCost, computeVendorCost, isLockActive } from './plan-cost';
import { computeRulesCost } from './rules';
import { deepFreeze } from '../test-utils/deep-freeze';

describe('Cost Engine', () => {
  describe('GOLDEN validation', () => {
    const plans = [
      { id: 'wedding-120' as const, plan: weddingPlan },
      { id: 'birthday-40' as const, plan: birthdayPlan },
      { id: 'community-300' as const, plan: communityPlan },
    ];

    it.each(plans)('computes correct totals for $id', ({ id, plan }) => {
      const expected = GOLDEN[id];
      const planCost = computePlanCost(plan);
      expect(planCost.total).toBe(expected.planTotal);
      expect(planCost.headroom).toBe(expected.headroom);

      const expectedTotals = expected.vendorTotals as Record<string, number>;
      for (const vendor of plan.vendors) {
        expect(computeVendorCost(vendor, plan).total).toBe(expectedTotals[vendor.id]);
      }
    });

    it('computes exact wedding vendor lines', () => {
      const expectedLines = GOLDEN['wedding-120'].lines!;
      for (const vendorId of ['venue', 'catering', 'decor'] as const) {
        const vendor = weddingPlan.vendors.find((v) => v.id === vendorId)!;
        const vendorCost = computeVendorCost(vendor, weddingPlan);
        const lineRecord = Object.fromEntries(vendorCost.lines.map((l) => [l.ruleId, l.amount]));
        expect(lineRecord).toEqual(expectedLines[vendorId]);
      }
    });

    it('computes exact wedding option totals', () => {
      const expectedOptions = GOLDEN['wedding-120'].optionTotals!;
      const checkOpt = (vId: string, oId: string) => {
        const v = weddingPlan.vendors.find((x) => x.id === vId)!;
        const opt = v.options.find((o) => o.id === oId)!;
        return computeRulesCost(opt.costRules, { attending: 120, billable: 120 }).total;
      };
      expect(checkOpt('venue', 'grand-ballroom')).toBe(expectedOptions['venue/grand-ballroom']);
      expect(checkOpt('catering', 'premium-menu')).toBe(expectedOptions['catering/premium-menu']);
      expect(checkOpt('catering', 'buffet-lite')).toBe(expectedOptions['catering/buffet-lite']);
    });
  });

  describe('Rule edge cases', () => {
    it('handles PER_GUEST min billable guests and default min', () => {
      const withMin = [perGuest('plates', 'Plates', 100, 100)];
      expect(computeRulesCost(withMin, { attending: 80, billable: 80 }).total).toBe(10_000);
      expect(computeRulesCost(withMin, { attending: 120, billable: 120 }).total).toBe(12_000);

      const withoutMin = [perGuest('plates', 'Plates', 100)];
      expect(computeRulesCost(withoutMin, { attending: 5, billable: 5 }).total).toBe(500);
    });

    it('handles tiered rules with tax (birthday pizza tiers)', () => {
      const tiers = [
        { fromGuests: 0, unitAmount: 1600 },
        { fromGuests: 30, unitAmount: 1400 },
        { fromGuests: 60, unitAmount: 1200 },
      ];
      const rules: CostRule[] = [
        tiered('pizza', 'Pizza', tiers, 20),
        surcharge('tax', 'Tax', 700, 'BASE_ONLY'),
      ];

      expect(computeRulesCost(rules, { attending: 29, billable: 29 }).total).toBe(49_648);
      expect(computeRulesCost(rules, { attending: 30, billable: 30 }).total).toBe(44_940);
      expect(computeRulesCost(rules, { attending: 59, billable: 59 }).total).toBe(88_382);
      expect(computeRulesCost(rules, { attending: 60, billable: 60 }).total).toBe(77_040);
      expect(computeRulesCost(rules, { attending: 10, billable: 10 }).total).toBe(34_240);

      const rulesNoMin = [tiered('pizza', 'Pizza', tiers)];
      expect(computeRulesCost(rulesNoMin, { attending: 10, billable: 10 }).total).toBe(16_000);
    });

    it('handles STEP units with guestsPerUnit 50', () => {
      const rules = [step('staff', 'Staff', 50, 1000)];
      const run = (g: number) => computeRulesCost(rules, { attending: g, billable: g }).total;
      expect([run(0), run(1), run(50), run(51), run(120)]).toEqual([0, 1000, 1000, 2000, 3000]);
    });

    it('handles surcharges on base 100000', () => {
      const baseRules: CostRule[] = [
        flat('base', 'Base', 100_000),
        surcharge('service', 'Service', 1000, 'BASE_ONLY'),
        surcharge('gst', 'Gst', 500, 'BASE_ONLY'),
      ];
      const baseCost = computeRulesCost(baseRules, { attending: 0, billable: 0 });
      expect([baseCost.lines[1]!.amount, baseCost.lines[2]!.amount, baseCost.total]).toEqual([
        10_000, 5000, 115_000,
      ]);

      const cascadedRules: CostRule[] = [
        flat('base', 'Base', 100_000),
        surcharge('service', 'Service', 1000, 'BASE_ONLY'),
        surcharge('gst', 'Gst', 500, 'BASE_PLUS_PRIOR_SURCHARGES'),
      ];
      const cascadedCost = computeRulesCost(cascadedRules, { attending: 0, billable: 0 });
      expect([
        cascadedCost.lines[1]!.amount,
        cascadedCost.lines[2]!.amount,
        cascadedCost.total,
      ]).toEqual([10_000, 5500, 115_500]);
    });

    it('handles rounding half away from zero', () => {
      const r1 = [flat('i', 'I', 12_345), surcharge('gst', 'Gst', 1800, 'BASE_ONLY')];
      expect(computeRulesCost(r1, { attending: 0, billable: 0 }).lines[1]!.amount).toBe(2222);

      const r2 = [flat('i', 'I', 25), surcharge('gst', 'Gst', 1800, 'BASE_ONLY')];
      expect(computeRulesCost(r2, { attending: 0, billable: 0 }).lines[1]!.amount).toBe(5);
    });
  });

  describe('Lock variants', () => {
    const caterer = weddingPlan.vendors.find((v) => v.id === 'catering')!;

    const build = (asOfDate: string, guestCount: number, redAllowed = false) => {
      const planCopy: Plan = { ...weddingPlan, asOfDate, guestCount };
      const vendorCopy: Vendor = {
        ...caterer,
        lock: { ...caterer.lock!, reductionsAllowedAfterLock: redAllowed, guaranteedGuests: 120 },
      };
      return { vendorCopy, planCopy };
    };

    it('evaluates lock status and caterer totals across dates', () => {
      const after = build('2026-11-29', 100);
      expect(isLockActive(after.vendorCopy, after.planCopy)).toBe(true);
      expect(computeVendorCost(after.vendorCopy, after.planCopy).total).toBe(14_553_000);

      const afterHigher = build('2026-11-29', 130);
      expect(computeVendorCost(afterHigher.vendorCopy, afterHigher.planCopy).total).toBe(
        16_343_250,
      );

      const afterRed = build('2026-11-29', 100, true);
      expect(computeVendorCost(afterRed.vendorCopy, afterRed.planCopy).total).toBe(12_358_500);

      const onLock = build('2026-11-28', 100);
      expect(isLockActive(onLock.vendorCopy, onLock.planCopy)).toBe(true);
      expect(computeVendorCost(onLock.vendorCopy, onLock.planCopy).total).toBe(14_553_000);

      const before = build('2026-11-27', 100);
      expect(isLockActive(before.vendorCopy, before.planCopy)).toBe(false);
      expect(computeVendorCost(before.vendorCopy, before.planCopy).total).toBe(12_358_500);
    });

    it('returns false for isLockActive and guestCount for billableGuests when vendor has no lock', () => {
      const noLockVendor: Vendor = { ...caterer, lock: undefined };
      expect(isLockActive(noLockVendor, weddingPlan)).toBe(false);
      expect(billableGuestsFor(noLockVendor, weddingPlan)).toBe(weddingPlan.guestCount);
    });

    it('evaluates birthday catering after lock with guaranteedGuests 40', () => {
      const bCat = birthdayPlan.vendors.find((v) => v.id === 'catering')!;
      const run = (guestCount: number) => {
        const plan: Plan = { ...birthdayPlan, asOfDate: '2026-11-14', guestCount };
        const v: Vendor = { ...bCat, lock: { ...bCat.lock!, guaranteedGuests: 40 } };
        return computeVendorCost(v, plan).total;
      };
      expect(run(30)).toBe(59_920);
      expect(run(45)).toBe(67_410);
    });
  });

  describe('DROPPED vendor', () => {
    it('yields cost 0 and decreases plan total when decor is dropped', () => {
      const withoutDecor: Plan = {
        ...weddingPlan,
        vendors: weddingPlan.vendors.map((v) =>
          v.id === 'decor' ? { ...v, status: 'DROPPED' } : v,
        ),
      };
      const dropped = withoutDecor.vendors.find((v) => v.id === 'decor')!;
      const vendorCost = computeVendorCost(dropped, withoutDecor);
      expect(vendorCost.total).toBe(0);
      expect(vendorCost.lines).toEqual([]);
      expect(computePlanCost(withoutDecor).total).toBe(46_896_000);
    });
  });

  describe('Property tests', () => {
    it('ensures sum of vendor totals equals plan total and vendor lines sum to vendor total', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 500 }), (guests) => {
          const planCost = computePlanCost({ ...weddingPlan, guestCount: guests });
          const vendorSum = planCost.vendors.reduce((acc, v) => acc + v.total, 0);
          expect(planCost.total).toBe(vendorSum);
          for (const vc of planCost.vendors) {
            expect(vc.total).toBe(vc.lines.reduce((acc, l) => acc + l.amount, 0));
          }
        }),
      );
    });

    it('is non-decreasing in guestCount for wedding plan [0, 400]', () => {
      let prev = 0;
      for (let g = 0; g <= 400; g++) {
        const cost = computePlanCost({ ...weddingPlan, guestCount: g }).total;
        expect(cost).toBeGreaterThanOrEqual(prev);
        prev = cost;
      }
    });

    it('is deterministic and safe on deep-frozen plans', () => {
      for (const plan of [weddingPlan, birthdayPlan, communityPlan]) {
        const frozen = deepFreeze(structuredClone(plan));
        expect(computePlanCost(frozen)).toEqual(computePlanCost(plan));
      }
    });
  });
});
