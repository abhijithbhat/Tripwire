/**
 * Recursively freezes an object and all nested objects/arrays to guarantee immutability.
 *
 * @param value The value to deep-freeze.
 * @returns The frozen value.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  for (const prop of Object.getOwnPropertyNames(value)) {
    const val = (value as Record<string, unknown>)[prop];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }

  return Object.freeze(value);
}
