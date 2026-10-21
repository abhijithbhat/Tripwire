import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareISODate,
  diffDays,
  fromDayNumber,
  isValidISODate,
  toDayNumber,
} from './dates';

describe('dates primitives', () => {
  describe('isValidISODate', () => {
    it('validates calendar dates accurately', () => {
      expect(isValidISODate('2026-12-12')).toBe(true);
      expect(isValidISODate('2028-02-29')).toBe(true);
      expect(isValidISODate('2026-02-29')).toBe(false);
      expect(isValidISODate('2026-02-30')).toBe(false);
      expect(isValidISODate('2026-13-01')).toBe(false);
      expect(isValidISODate('2026-1-01')).toBe(false);
      expect(isValidISODate('1969-12-31')).toBe(false);
      expect(isValidISODate('2101-01-01')).toBe(false);
    });
  });

  describe('toDayNumber and fromDayNumber', () => {
    it('matches boundary day numbers', () => {
      expect(toDayNumber('1970-01-01')).toBe(0);
      expect(toDayNumber('2100-12-31')).toBe(47846);
      expect(() => toDayNumber('2026-02-30')).toThrow(RangeError);
    });

    it('rejects out of range day numbers in fromDayNumber', () => {
      expect(() => fromDayNumber(-1)).toThrow(RangeError);
      expect(() => fromDayNumber(47847)).toThrow(RangeError);
      expect(() => fromDayNumber(1.5)).toThrow(RangeError);
    });

    it('satisfies roundtrip invariant with fast-check', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 47846 }), (n) => toDayNumber(fromDayNumber(n)) === n),
      );
    });
  });

  describe('addDays', () => {
    it('matches hand-computed golden values', () => {
      expect(addDays('2026-12-12', -120)).toBe('2026-08-14');
      expect(addDays('2026-12-12', -45)).toBe('2026-10-28');
      expect(addDays('2026-12-12', -60)).toBe('2026-10-13');
      expect(addDays('2026-12-12', -90)).toBe('2026-09-13');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('throws RangeError when resulting date exceeds 1970..2100 or input is invalid', () => {
      expect(() => addDays('invalid', 1)).toThrow(RangeError);
      expect(() => addDays('1970-01-01', -1)).toThrow(RangeError);
      expect(() => addDays('2100-12-31', 1)).toThrow(RangeError);
      expect(() => addDays('2026-01-01', 1.5)).toThrow(RangeError);
    });
  });

  describe('diffDays', () => {
    it('matches hand-computed golden values', () => {
      expect(diffDays('2026-12-12', '2026-10-28')).toBe(45);
      expect(diffDays('2026-10-28', '2026-12-12')).toBe(-45);
    });
  });

  describe('compareISODate', () => {
    it('matches comparison values', () => {
      expect(compareISODate('2026-10-28', '2026-12-12')).toBe(-1);
      expect(compareISODate('2026-12-12', '2026-10-28')).toBe(1);
      expect(compareISODate('2026-12-12', '2026-12-12')).toBe(0);
    });

    it('throws on invalid dates', () => {
      expect(() => compareISODate('invalid', '2026-12-12')).toThrow(RangeError);
      expect(() => compareISODate('2026-12-12', 'invalid')).toThrow(RangeError);
    });
  });
});
