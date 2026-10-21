/**
 * Money and basis point types and mathematical primitives.
 *
 * All money is represented as integer minor units (paise/cents).
 * Percentages are integer basis points where 10_000 = 100%.
 */

export type Money = number; // integer minor units (paise/cents); may be negative for deltas
export type Bp = number; // integer basis points; 10_000 = 100%

export const BP_SCALE = 10_000;

/**
 * Asserts that the given value is a safe integer.
 *
 * @param n Value to check.
 * @param name Parameter name for error messages.
 * @throws {RangeError} If n is not a safe integer.
 */
export function assertSafeInt(n: number, name = 'value'): void {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${name} must be a safe integer, got ${n}`);
  }
}

/**
 * Sums an array of Money values exactly.
 *
 * @param values Array of Money amounts.
 * @returns Total sum as Money.
 * @throws {RangeError} If any value or running total is not a safe integer.
 */
export function sumMoney(values: readonly Money[]): Money {
  let total = 0;
  for (const v of values) {
    assertSafeInt(v, 'Money value');
    total += v;
    assertSafeInt(total, 'Running money sum');
  }
  return total;
}

/**
 * Multiplies an amount by basis points with half away from zero integer rounding.
 *
 * @param amount Money amount.
 * @param bp Basis points (10_000 = 100%).
 * @returns Rounded Money amount.
 * @throws {RangeError} If amount, bp, or product is not a safe integer.
 */
export function mulBp(amount: Money, bp: Bp): Money {
  assertSafeInt(amount, 'amount');
  assertSafeInt(bp, 'bp');

  const n = amount * bp;
  assertSafeInt(n, 'amount * bp');

  const q = Math.trunc(n / BP_SCALE);
  const r = n - q * BP_SCALE;
  const res = Math.abs(r) * 2 >= BP_SCALE ? q + Math.sign(n) : q;

  return Object.is(res, -0) ? 0 : res;
}

/**
 * Splits a total Money amount according to basis points.
 * All parts except the last are calculated with mulBp; the last part absorbs remainder.
 *
 * @param total Total money to split.
 * @param bps Basis points for each slice (must sum to exactly 10_000).
 * @returns Array of Money slices summing exactly to total.
 * @throws {RangeError} If bps do not sum to 10_000 or values are not safe integers.
 */
export function splitByBp(total: Money, bps: readonly Bp[]): Money[] {
  assertSafeInt(total, 'total');

  let bpSum = 0;
  for (const bp of bps) {
    assertSafeInt(bp, 'bp');
    bpSum += bp;
  }

  if (bpSum !== BP_SCALE) {
    throw new RangeError(`Basis points must sum to exactly ${BP_SCALE}, got ${bpSum}`);
  }

  const parts: Money[] = [];
  let allocated = 0;

  for (let i = 0; i < bps.length - 1; i++) {
    const bp = bps[i]!;
    const part = mulBp(total, bp);
    parts.push(part);
    allocated += part;
    assertSafeInt(allocated, 'Allocated sum');
  }

  parts.push(total - allocated);
  return parts;
}

/**
 * Performs ceiling integer division of a by b.
 *
 * @param a Numerator (must be integer >= 0).
 * @param b Denominator (must be integer >= 1).
 * @returns Ceiled quotient.
 * @throws {RangeError} If a < 0, b < 1, or either is not a safe integer.
 */
export function ceilDiv(a: number, b: number): number {
  assertSafeInt(a, 'a');
  assertSafeInt(b, 'b');

  if (a < 0) {
    throw new RangeError(`a must be >= 0, got ${a}`);
  }
  if (b < 1) {
    throw new RangeError(`b must be >= 1, got ${b}`);
  }

  if (a === 0) {
    return 0;
  }

  return Math.floor((a + b - 1) / b);
}
