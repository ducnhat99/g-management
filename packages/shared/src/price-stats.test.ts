import { describe, expect, it } from 'vitest';
import {
  PRICE_STATS_DAY_COUNT,
  PRICE_STATS_MONTH_COUNT,
  calculatePriceStats,
  periodOf,
  priceStatsSeries,
  shiftPeriod,
  type PriceStatsSnapshot,
} from './price-stats';

// 2026-11-09 14:00 in Vietnam.
const NOW = new Date('2026-11-09T07:00:00Z');

function snap(sourceUpdatedAt: string, buyPrice: number, sellPrice = buyPrice + 300_000) {
  return { sourceUpdatedAt, buyPrice, sellPrice } satisfies PriceStatsSnapshot;
}

describe('periodOf', () => {
  it('uses Vietnam time: 18:00 UTC is already the next day', () => {
    const instant = new Date('2026-12-31T18:00:00Z');
    expect(periodOf(instant, 'day')).toBe('2027-01-01');
    expect(periodOf(instant, 'month')).toBe('2027-01');
    expect(periodOf(instant, 'year')).toBe('2027');
  });
});

describe('shiftPeriod', () => {
  it.each([
    ['2026-03-01', -1, 'day', '2026-02-28'],
    ['2024-02-28', 1, 'day', '2024-02-29'],
    ['2026-01', -1, 'month', '2025-12'],
    ['2026-11', -11, 'month', '2025-12'],
    ['2026-12', 1, 'month', '2027-01'],
    ['2026', -1, 'year', '2025'],
  ] as const)('%s %+d %s -> %s', (period, steps, granularity, expected) => {
    expect(shiftPeriod(period, steps, granularity)).toBe(expected);
  });
});

describe('priceStatsSeries', () => {
  it('day: 30 days ending today, all unknown when there is no data', () => {
    const points = priceStatsSeries([], 'day', NOW);
    expect(points).toHaveLength(PRICE_STATS_DAY_COUNT);
    expect(points[0]?.period).toBe('2026-10-11');
    expect(points.at(-1)?.period).toBe('2026-11-09');
    expect(points.every((p) => !p.hasData && p.closeBuy === null && p.changeBuyPct === null)).toBe(
      true,
    );
  });

  it('closes a day with its last snapshot, whatever the input order', () => {
    const points = priceStatsSeries(
      [
        snap('2026-11-09T05:00:00Z', 13_300_000), // 12:00
        snap('2026-11-09T01:00:00Z', 13_100_000), // 08:00
        snap('2026-11-08T03:00:00Z', 13_000_000),
      ],
      'day',
      NOW,
    );
    const today = points.at(-1)!;
    expect(today).toEqual({
      period: '2026-11-09',
      hasData: true,
      closeBuy: 13_300_000,
      closeSell: 13_600_000,
      changeBuy: 300_000,
      changeSell: 300_000,
      changeBuyPct: 2.31, // 300.000 / 13.000.000 = 2.3077 %
      changeSellPct: 2.26, // 300.000 / 13.300.000 = 2.2556 %
    });
  });

  it('carries the last close forward over days with no snapshot', () => {
    const points = priceStatsSeries(
      [snap('2026-11-06T03:00:00Z', 13_000_000), snap('2026-11-09T03:00:00Z', 12_870_000)],
      'day',
      NOW,
    );
    const [d6, d7, d8, d9] = points.slice(-4);
    expect(d6).toMatchObject({ hasData: true, closeBuy: 13_000_000 });
    expect(d7).toMatchObject({
      hasData: false,
      closeBuy: 13_000_000,
      changeBuy: 0,
      changeBuyPct: 0,
    });
    expect(d8).toMatchObject({ hasData: false, closeBuy: 13_000_000, changeBuy: 0 });
    expect(d9).toMatchObject({ hasData: true, changeBuy: -130_000, changeBuyPct: -1 });
  });

  it('has no change for the first period with data and none before it', () => {
    const points = priceStatsSeries([snap('2026-11-08T03:00:00Z', 13_000_000)], 'day', NOW);
    expect(points.at(-3)).toMatchObject({ closeBuy: null, changeBuy: null });
    expect(points.at(-2)).toMatchObject({
      hasData: true,
      closeBuy: 13_000_000,
      changeBuyPct: null,
    });
    expect(points.at(-1)).toMatchObject({ hasData: false, closeBuy: 13_000_000, changeBuyPct: 0 });
  });

  it('compares the first shown day with a close from before the window', () => {
    const points = priceStatsSeries(
      [snap('2026-09-01T03:00:00Z', 12_000_000), snap('2026-10-11T03:00:00Z', 12_600_000)],
      'day',
      NOW,
    );
    expect(points[0]).toMatchObject({
      period: '2026-10-11',
      changeBuy: 600_000,
      changeBuyPct: 5,
    });
  });

  it('rounds the percentage half away from zero', () => {
    // -0.825 % -> -0.83 %
    const points = priceStatsSeries(
      [snap('2026-11-08T03:00:00Z', 4_000_000), snap('2026-11-09T03:00:00Z', 3_967_000)],
      'day',
      NOW,
    );
    expect(points.at(-1)?.changeBuyPct).toBe(-0.83);
  });

  it('ignores snapshots after now', () => {
    const points = priceStatsSeries([snap('2026-11-10T03:00:00Z', 13_000_000)], 'day', NOW);
    expect(points.at(-1)).toMatchObject({ period: '2026-11-09', closeBuy: null });
  });

  it('month: 12 months ending this month, closed by the last snapshot of each', () => {
    const points = priceStatsSeries(
      [
        snap('2026-10-02T03:00:00Z', 12_000_000),
        snap('2026-10-31T16:30:00Z', 12_500_000), // 23:30 on 31/10 in Vietnam
        snap('2026-10-31T17:30:00Z', 12_800_000), // 00:30 on 01/11 in Vietnam
        snap('2026-11-05T03:00:00Z', 13_000_000),
      ],
      'month',
      NOW,
    );
    expect(points).toHaveLength(PRICE_STATS_MONTH_COUNT);
    expect(points[0]?.period).toBe('2025-12');
    expect(points.at(-2)).toMatchObject({ period: '2026-10', closeBuy: 12_500_000 });
    expect(points.at(-1)).toMatchObject({
      period: '2026-11',
      closeBuy: 13_000_000,
      changeBuy: 500_000,
      changeBuyPct: 4,
    });
  });

  it('year: from the first year with data to this year', () => {
    const points = priceStatsSeries(
      [snap('2024-06-01T03:00:00Z', 8_000_000), snap('2026-11-09T03:00:00Z', 13_200_000)],
      'year',
      NOW,
    );
    expect(points.map((p) => p.period)).toEqual(['2024', '2025', '2026']);
    expect(points[0]).toMatchObject({ hasData: true, closeBuy: 8_000_000, changeBuy: null });
    expect(points[1]).toMatchObject({ hasData: false, closeBuy: 8_000_000, changeBuy: 0 });
    expect(points[2]).toMatchObject({ hasData: true, changeBuy: 5_200_000, changeBuyPct: 65 });
  });
});

describe('calculatePriceStats', () => {
  it('counts snapshots and reports the newest source time', () => {
    const stats = calculatePriceStats(
      [snap('2026-11-09T03:00:00Z', 13_000_000), snap('2026-11-08T03:00:00Z', 12_900_000)],
      NOW,
    );
    expect(stats.snapshotCount).toBe(2);
    expect(stats.lastUpdatedAt).toBe('2026-11-09T03:00:00.000Z');
    expect(stats.day).toHaveLength(PRICE_STATS_DAY_COUNT);
    expect(stats.month).toHaveLength(PRICE_STATS_MONTH_COUNT);
    expect(stats.year.map((p) => p.period)).toEqual(['2026']);
  });

  it('is empty-safe', () => {
    const stats = calculatePriceStats([], NOW);
    expect(stats.snapshotCount).toBe(0);
    expect(stats.lastUpdatedAt).toBeNull();
    expect(stats.year).toEqual([
      expect.objectContaining({ period: '2026', closeBuy: null, hasData: false }),
    ]);
  });
});
