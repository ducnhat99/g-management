import { describe, expect, it } from 'vitest';
import { getAppInfo } from './app-info';

describe('getAppInfo', () => {
  it('returns the app name and display name', () => {
    expect(getAppInfo()).toEqual({ name: 'gold-tracker', displayName: 'Quản lý vàng' });
  });
});
