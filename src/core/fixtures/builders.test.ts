import { describe, expect, it } from 'vitest';
import { CostRuleSchema } from '../domain/schema';
import { validatePlan } from '../domain/validate';
import {
  cancel,
  dollars,
  flat,
  makePlan,
  makeVendor,
  milestone,
  perGuest,
  rupees,
  step,
  surcharge,
  tiered,
} from './builders';

describe('builders', () => {
  it('converts units to minor units with rounding', () => {
    expect(rupees(1234.56)).toBe(123456);
    expect(rupees(0.1 + 0.2)).toBe(30);
    expect(dollars(10.5)).toBe(1050);
  });

  it('generates defaults that pass validatePlan', () => {
    const vendor = makeVendor({
      id: 'venue-1',
      name: 'Default Venue',
      category: 'VENUE',
      costRules: [flat('rental', 'Venue Rental', rupees(100_000))],
    });

    const plan = makePlan({
      vendors: [vendor],
    });

    const result = validatePlan(plan);
    expect(result.ok).toBe(true);
  });

  it('returns schema-valid cost rules for every builder', () => {
    const rules = [
      flat('r1', 'Flat Rule', 1000),
      perGuest('r2', 'Per Guest', 250),
      perGuest('r2-min', 'Per Guest Min', 250, 50),
      tiered('r3', 'Tiered Rule', [
        { fromGuests: 0, unitAmount: 300 },
        { fromGuests: 100, unitAmount: 250 },
      ]),
      step('r4', 'Step Rule', 10, 5000),
      surcharge('r5', 'Surcharge Base', 1800, 'BASE_ONLY'),
      surcharge('r6', 'Surcharge Prior', 500, 'BASE_PLUS_PRIOR_SURCHARGES'),
    ];

    for (const rule of rules) {
      const parsed = CostRuleSchema.safeParse(rule);
      expect(parsed.success).toBe(true);
    }
  });

  it('creates valid milestone and cancellation fixtures', () => {
    const ms = milestone('deposit', 'Deposit', 2000, 30, true);
    expect(ms).toEqual({
      id: 'deposit',
      label: 'Deposit',
      pctBp: 2000,
      dueOffsetDays: 30,
      paid: true,
    });

    const tier = cancel(14, 5000);
    expect(tier).toEqual({
      minDaysBefore: 14,
      forfeitPctBp: 5000,
    });
  });
});
