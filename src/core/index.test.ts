import { describe, expect, it } from 'vitest';
import {
  CORE_VERSION,
  applyChange,
  applyChanges,
  STATUS_SEVERITY,
  billableGuestsFor,
  computePaymentTimeline,
  computePlanCost,
  computeRulesCost,
  computeVendorCost,
  evaluateBudgetCap,
  evaluatePlan,
  isLockActive,
  parseChangeSet,
  worstStatus,
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

  it('exports change engine functions and schemas', () => {
    expect(typeof parseChangeSet).toBe('function');
    expect(typeof applyChange).toBe('function');
    expect(typeof applyChanges).toBe('function');
  });

  it('exports evaluate engine functions and constants', () => {
    expect(typeof evaluatePlan).toBe('function');
    expect(typeof worstStatus).toBe('function');
    expect(typeof evaluateBudgetCap).toBe('function');
    expect(STATUS_SEVERITY.TRIPPED).toBe(3);
  });
});
