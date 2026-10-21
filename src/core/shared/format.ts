import type { Money } from './money';

/**
 * Formats minor unit money into localized currency representation.
 *
 * @param amount Money in integer minor units (e.g. paise/cents).
 * @param currency ISO 4217 currency code (e.g. 'INR', 'USD').
 * @param locale BCP 47 language tag (defaults to 'en-IN').
 * @returns Formatted currency string.
 */
export function formatMoney(amount: Money, currency: string, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100);
}
