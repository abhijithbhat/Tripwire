import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from './index';

describe('CORE_VERSION', () => {
  it('matches semantic version pattern', () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
