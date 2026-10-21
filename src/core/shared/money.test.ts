import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { assertSafeInt, ceilDiv, mulBp, splitByBp, sumMoney } from './money';

describe('money primitives', () => {
  describe('assertSafeInt', () => {
    it('accepts safe integers', () => {
      expect(() => assertSafeInt(0)).not.toThrow();
      expect(() => assertSafeInt(-100)).not.toThrow();
      expect(() => assertSafeInt(Number.MAX_SAFE_INTEGER)).not.toThrow();
      expect(() => assertSafeInt(Number.MIN_SAFE_INTEGER)).not.toThrow();
    });

    it('rejects non-integers and unsafe numbers', () => {
      expect(() => assertSafeInt(1.5)).toThrow(RangeError);
      expect(() => assertSafeInt(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
      expect(() => assertSafeInt(Number.NaN)).toThrow(RangeError);
      expect(() => assertSafeInt(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    });
  });

  describe('mulBp', () => {
    it('matches hand-computed golden values', () => {
      expect(mulBp(100, 1800)).toBe(18);
      expect(mulBp(1, 5000)).toBe(1);
      expect(mulBp(1, 4999)).toBe(0);
      expect(mulBp(3, 1666)).toBe(0);
      expect(mulBp(-100, 1800)).toBe(-18);
      expect(mulBp(-1, 5000)).toBe(-1);
      expect(mulBp(-1, 0)).toBe(0);
      expect(mulBp(0, 9999)).toBe(0);
      expect(mulBp(25, 1800)).toBe(5);
      expect(mulBp(12345, 1800)).toBe(2222);
      expect(mulBp(12350, 1800)).toBe(2223);
    });

    it('throws on non-safe integers', () => {
      expect(() => mulBp(1.5, 1000)).toThrow(RangeError);
      expect(() => mulBp(1000, 1.5)).toThrow(RangeError);
      expect(() => mulBp(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
    });

    it('satisfies half away from zero invariant with fast-check', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1e9 }),
          fc.integer({ min: 0, max: 100_000 }),
          (a, bp) => Math.abs(mulBp(a, bp) * 10_000 - a * bp) <= 5000,
        ),
      );
    });
  });

  describe('splitByBp', () => {
    it('matches hand-computed golden values', () => {
      expect(splitByBp(1001, [3333, 3333, 3334])).toEqual([334, 334, 333]);
      expect(splitByBp(100, [5000, 5000])).toEqual([50, 50]);
      expect(splitByBp(101, [5000, 5000])).toEqual([51, 50]);
      expect(splitByBp(0, [10000])).toEqual([0]);
    });

    it('throws RangeError when bps do not sum to 10_000', () => {
      expect(() => splitByBp(100, [5000, 4000])).toThrow(RangeError);
      expect(() => splitByBp(100, [5000, 5001])).toThrow(RangeError);
      expect(() => splitByBp(100, [])).toThrow(RangeError);
    });

    it('throws on non-safe integers', () => {
      expect(() => splitByBp(100.5, [5000, 5000])).toThrow(RangeError);
      expect(() => splitByBp(100, [5000.5, 4999.5])).toThrow(RangeError);
    });

    it('satisfies conservation and non-negativity invariant with fast-check', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1e9 }),
          fc.integer({ min: 0, max: 10_000 }),
          (total, x) => {
            const parts = splitByBp(total, [x, 10_000 - x]);
            return parts[0]! + parts[1]! === total && parts[0]! >= 0 && parts[1]! >= 0;
          },
        ),
      );
    });
  });

  describe('ceilDiv', () => {
    it('matches hand-computed golden values', () => {
      expect(ceilDiv(120, 50)).toBe(3);
      expect(ceilDiv(100, 50)).toBe(2);
      expect(ceilDiv(0, 50)).toBe(0);
      expect(ceilDiv(1, 50)).toBe(1);
    });

    it('throws RangeError for invalid domain inputs', () => {
      expect(() => ceilDiv(5, 0)).toThrow(RangeError);
      expect(() => ceilDiv(-1, 5)).toThrow(RangeError);
      expect(() => ceilDiv(1.5, 2)).toThrow(RangeError);
      expect(() => ceilDiv(2, 1.5)).toThrow(RangeError);
    });
  });

  describe('sumMoney', () => {
    it('matches hand-computed golden values', () => {
      expect(sumMoney([1, 2, 3])).toBe(6);
      expect(sumMoney([])).toBe(0);
      expect(sumMoney([-5, 10, -2])).toBe(3);
    });

    it('throws RangeError for unsafe or non-integer inputs and overflow', () => {
      expect(() => sumMoney([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
      expect(() => sumMoney([1.5])).toThrow(RangeError);
    });
  });
});
