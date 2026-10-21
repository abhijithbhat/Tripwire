import { describe, expect, it } from 'vitest';
import { validatePlan } from '../domain/validate';
import { birthdayPlan } from './birthday-40';
import { communityPlan } from './community-300';
import { GOLDEN } from './golden';
import { weddingPlan } from './wedding-120';

describe('fixture plans and golden truth', () => {
  const plans = [
    { key: 'wedding-120', plan: weddingPlan, expectedVendorCount: 4 },
    { key: 'birthday-40', plan: birthdayPlan, expectedVendorCount: 3 },
    { key: 'community-300', plan: communityPlan, expectedVendorCount: 4 },
  ] as const;

  it('(a) all three plans pass validatePlan without issues', () => {
    for (const { key, plan } of plans) {
      const result = validatePlan(plan);
      expect(
        result.ok,
        `Plan ${key} failed validation: ${JSON.stringify(!result.ok ? result.issues : [])}`,
      ).toBe(true);
    }
  });

  it('(b) vendor counts are exactly 4, 3, and 4', () => {
    expect(weddingPlan.vendors.length).toBe(4);
    expect(birthdayPlan.vendors.length).toBe(3);
    expect(communityPlan.vendors.length).toBe(4);
  });

  it('(c) inside GOLDEN, vendor totals sum to planTotal, timeline amounts sum to planTotal, and planTotal + headroom equals budgetCap', () => {
    for (const { key, plan } of plans) {
      const golden = GOLDEN[key];

      const vendorSum = Object.values(golden.vendorTotals).reduce(
        (sum: number, total: number) => sum + total,
        0,
      );
      expect(vendorSum, `${key}: vendorTotals must sum to planTotal`).toBe(golden.planTotal);

      const timelineSum = golden.timeline.reduce((sum: number, item) => sum + item.amount, 0);
      expect(timelineSum, `${key}: timeline amounts must sum to planTotal`).toBe(golden.planTotal);

      expect(
        golden.planTotal + golden.headroom,
        `${key}: planTotal + headroom must equal budgetCap`,
      ).toBe(plan.budgetCap);
    }
  });
});
