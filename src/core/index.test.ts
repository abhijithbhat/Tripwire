import { describe, expect, it } from 'vitest';
import {
  CORE_VERSION,
  billableGuestsFor,
  computePaymentTimeline,
  computePlanCost,
  computeRulesCost,
  computeVendorCost,
  isLockActive,
} from './index';

describe('index exports', () => {
  it('matches semantic version pattern', () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exports cost and payment engine functions', () => {
    expect(typeof computeRulesCost).toBe('function');
    expect(typeof isLockActive).toBe('function');
    expect(typeof billableGuestsFor).toBe('function');
    expect(typeof computeVendorCost).toBe('function');
    expect(typeof computePlanCost).toBe('function');
    expect(typeof computePaymentTimeline).toBe('function');
  });
});
