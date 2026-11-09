import type { PriceStatsPointDto } from '@gold/shared';
import { describe, expect, it } from 'vitest';
import { areaPath, barMax, labelIndexes, linePath, priceScale, ticks, xAt } from './chart-geometry';

const point = (
  closeBuy: number | null,
  closeSell: number | null = closeBuy,
): PriceStatsPointDto => ({
  period: '2026-11-09',
  hasData: closeBuy !== null,
  closeBuy,
  closeSell,
  changeBuy: null,
  changeSell: null,
  changeBuyPct: null,
  changeSellPct: null,
});

describe('xAt', () => {
  it('puts points in the middle of their slot', () => {
    expect(xAt(0, 4)).toBe(125);
    expect(xAt(3, 4)).toBe(875);
  });
});

describe('priceScale', () => {
  it('spans both lines with headroom and ignores unknown closes', () => {
    const { lo, hi, y } = priceScale([
      point(null),
      point(100_000_000, 101_000_000),
      point(102_000_000, 103_000_000),
    ]);
    expect(lo).toBeCloseTo(99_580_000);
    expect(hi).toBeCloseTo(103_420_000);
    expect(y(hi)).toBe(0);
    expect(y(lo)).toBe(260);
  });

  it('still has a range when every price is the same', () => {
    const { lo, hi } = priceScale([point(13_000_000)]);
    expect(hi - lo).toBe(200_000);
  });
});

describe('linePath / areaPath', () => {
  const points = [point(null), point(10), point(20)];
  const y = (v: number) => v;

  it('starts at the first known close', () => {
    expect(linePath(points, 'buy', y)).toBe('M500.0 10.0 L833.3 20.0');
  });

  it('closes the area along the bottom edge', () => {
    expect(areaPath(points, 'buy', y)).toBe('M500.0 10.0 L833.3 20.0 L833.3 260 L500.0 260 Z');
    expect(areaPath([point(null)], 'buy', y)).toBe('');
  });
});

describe('ticks', () => {
  it('runs from hi to lo', () => {
    expect(ticks(0, 100)).toEqual([100, 75, 50, 25, 0]);
  });
});

describe('labelIndexes', () => {
  it.each([
    [30, [4, 9, 14, 19, 24, 29]],
    [12, [1, 3, 5, 7, 9, 11]],
    [3, [0, 1, 2]],
  ])('%i points -> %j', (count, expected) => {
    expect(labelIndexes(count)).toEqual(expected);
  });
});

describe('barMax', () => {
  it('leaves 20 % headroom over the largest change', () => {
    expect(barMax([1, -2.5, null])).toBeCloseTo(3);
    expect(barMax([null, 0])).toBeCloseTo(0.12);
  });
});
