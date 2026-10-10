import { describe, expect, it } from 'vitest';
import { siteTitle } from './site';

describe('siteTitle', () => {
  it('comes from @gold/shared', () => {
    expect(siteTitle).toBe('G-management');
  });
});
