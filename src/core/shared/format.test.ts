import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  it('formats amounts matching hand-computed golden values', () => {
    expect(formatMoney(65776000, 'INR', 'en-US')).toBe('₹657,760.00');
    expect(formatMoney(10000, 'USD', 'en-US')).toBe('$100.00');
    expect(formatMoney(-5000, 'USD', 'en-US')).toBe('-$50.00');
  });

  it('uses en-IN as the default locale', () => {
    const formatted = formatMoney(10000000, 'INR');
    expect(formatted).toContain('1,00,000.00');
  });
});
