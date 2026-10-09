import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  formatDateTimeVN,
  formatDateVN,
  formatSignedVND,
  pnlColor,
} from './format';

const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatDateTimeVN', () => {
  it('shows Vietnam time in the "HH:mm dd/MM/yyyy" shape Ngọc Thịnh uses', () => {
    expect(formatDateTimeVN('2026-10-09T02:15:00.000Z')).toBe('09:15 09/10/2026');
  });

  it('rolls over to the next day in Vietnam', () => {
    expect(formatDateTimeVN('2026-10-08T18:30:00.000Z')).toBe('01:30 09/10/2026');
  });
});

describe('formatDateVN', () => {
  it('turns YYYY-MM-DD into dd/MM/yyyy', () => {
    expect(formatDateVN('2026-01-15')).toBe('15/01/2026');
  });
});

describe('formatCountdown', () => {
  it.each([
    [3_600_000, '1:00:00'],
    [3_599_000, '59:59'],
    [61_000, '1:01'],
    [500, '0:01'],
    [0, '0:00'],
    [-5_000, '0:00'],
  ])('%d ms -> %s', (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});

describe('formatSignedVND / pnlColor', () => {
  it('adds + only to profits', () => {
    expect(plain(formatSignedVND(6_920_000))).toBe('+6.920.000 ₫');
    expect(plain(formatSignedVND(-55_000))).toBe('-55.000 ₫');
    expect(plain(formatSignedVND(0))).toBe('0 ₫');
  });

  it('is green for profit, red for loss', () => {
    expect(pnlColor(1)).toContain('emerald');
    expect(pnlColor(-1)).toContain('red');
    expect(pnlColor(null)).toContain('stone');
  });
});
