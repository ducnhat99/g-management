import { describe, expect, it } from 'vitest';
import { costOf } from './money';

describe('costOf', () => {
  it('multiplies thousandths of a chỉ by the price', () => {
    expect(costOf(5000, 12_000_000)).toBe(60_000_000);
    expect(costOf(500, 13_350_000)).toBe(6_675_000);
  });

  it('rounds half-up to whole đồng', () => {
    expect(costOf(1, 13_240_500)).toBe(13_241); // 13.240,5
    expect(costOf(1, 13_240_400)).toBe(13_240); // 13.240,4
  });

  it('stays exact for the largest allowed quantity and price', () => {
    expect(costOf(10_000_000, 100_000_000)).toBe(1_000_000_000_000);
  });
});
