/**
 * Deterministic calendar and date primitives.
 *
 * Confined strictly to UTC and years 1970..2100.
 * Never reads system clock or uses non-deterministic APIs.
 */

export type ISODate = string; // 'YYYY-MM-DD'

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;
const MAX_DAY_NUMBER = 47846; // 2100-12-31
const MS_PER_DAY = 86_400_000;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether a string is a strict YYYY-MM-DD calendar date in years 1970..2100.
 * Accurately accounts for leap years.
 *
 * @param s Input string.
 * @returns True if valid calendar date, false otherwise.
 */
export function isValidISODate(s: string): boolean {
  if (typeof s !== 'string' || !ISO_DATE_REGEX.test(s)) {
    return false;
  }

  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return false;
  }

  if (month < 1 || month > 12) {
    return false;
  }

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const maxDays = daysInMonths[month - 1];
  if (maxDays === undefined || day < 1 || day > maxDays) {
    return false;
  }

  return true;
}

/**
 * Converts an ISODate to days elapsed since 1970-01-01 UTC.
 *
 * @param d ISODate string in YYYY-MM-DD format.
 * @returns Integer day number (0 for 1970-01-01, 47846 for 2100-12-31).
 * @throws {RangeError} If d is not a valid ISODate in 1970..2100.
 */
export function toDayNumber(d: ISODate): number {
  if (!isValidISODate(d)) {
    throw new RangeError(`Invalid ISODate: ${d}`);
  }

  const year = Number(d.slice(0, 4));
  const month = Number(d.slice(5, 7)) - 1;
  const day = Number(d.slice(8, 10));

  const ms = Date.UTC(year, month, day);
  return Math.floor(ms / MS_PER_DAY);
}

/**
 * Converts a day number back into an ISODate string.
 *
 * @param n Integer days since 1970-01-01 UTC (in 0..47846).
 * @returns ISODate string in YYYY-MM-DD format.
 * @throws {RangeError} If n is not an integer in 0..47846.
 */
export function fromDayNumber(n: number): ISODate {
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_DAY_NUMBER) {
    throw new RangeError(`Day number must be an integer in 0..${MAX_DAY_NUMBER}, got ${n}`);
  }

  const dt = new Date(n * MS_PER_DAY);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/**
 * Adds (or subtracts) an integer number of days to an ISODate.
 *
 * @param d Starting ISODate.
 * @param n Integer days to add (may be negative).
 * @returns Resulting ISODate.
 * @throws {RangeError} If d is invalid, n is not safe integer, or result leaves 1970..2100.
 */
export function addDays(d: ISODate, n: number): ISODate {
  if (!isValidISODate(d)) {
    throw new RangeError(`Invalid ISODate: ${d}`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`Days to add must be a safe integer, got ${n}`);
  }

  const resultDay = toDayNumber(d) + n;
  if (resultDay < 0 || resultDay > MAX_DAY_NUMBER) {
    throw new RangeError(`Resulting date is out of supported range 1970..2100 (day ${resultDay})`);
  }

  return fromDayNumber(resultDay);
}

/**
 * Calculates day difference: a minus b (positive if a is after b).
 *
 * @param a First ISODate.
 * @param b Second ISODate.
 * @returns Integer difference in days (a - b).
 * @throws {RangeError} If either date is invalid.
 */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(a) - toDayNumber(b);
}

/**
 * Compares two ISODates chronologically.
 *
 * @param a First ISODate.
 * @param b Second ISODate.
 * @returns -1 if a < b, 0 if a === b, 1 if a > b.
 * @throws {RangeError} If either date is invalid.
 */
export function compareISODate(a: ISODate, b: ISODate): -1 | 0 | 1 {
  if (!isValidISODate(a)) {
    throw new RangeError(`Invalid ISODate: ${a}`);
  }
  if (!isValidISODate(b)) {
    throw new RangeError(`Invalid ISODate: ${b}`);
  }

  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
