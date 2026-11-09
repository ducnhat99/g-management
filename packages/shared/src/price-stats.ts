import { todayInVietnam } from './dates';
import { divideRounded } from './portfolio';

export type PriceStatsGranularity = 'day' | 'month' | 'year';

/** How many periods the day and month series show (the year series starts at the first data). */
export const PRICE_STATS_DAY_COUNT = 30;
export const PRICE_STATS_MONTH_COUNT = 12;

/** One stored snapshot, as the stats calculation needs it. */
export interface PriceStatsSnapshot {
  buyPrice: number;
  sellPrice: number;
  /** ISO time printed on the Ngọc Thịnh site. Decides which period the snapshot belongs to. */
  sourceUpdatedAt: string;
}

/** One day, month or year. Closing prices are VND per chỉ. */
export interface PriceStatsPointDto {
  /** "2026-11-09" (day), "2026-11" (month) or "2026" (year), in Vietnam time. */
  period: string;
  /** False when no snapshot falls in this period: the close is carried forward from before. */
  hasData: boolean;
  /** Last price in the period, or the last known price before it. Null before the first snapshot. */
  closeBuy: number | null;
  closeSell: number | null;
  /** Close minus the previous period's close. Null when either close is unknown. */
  changeBuy: number | null;
  changeSell: number | null;
  /** change / previous close × 100, 2 decimals. Null when either close is unknown. */
  changeBuyPct: number | null;
  changeSellPct: number | null;
}

/** GET /prices/stats. Every series is oldest first and ends at the current period. */
export interface PriceStatsDto {
  /** Number of stored snapshots. The page needs at least 2 to show anything useful. */
  snapshotCount: number;
  /** sourceUpdatedAt of the newest snapshot. */
  lastUpdatedAt: string | null;
  day: PriceStatsPointDto[];
  month: PriceStatsPointDto[];
  year: PriceStatsPointDto[];
}

const PERIOD_LENGTH: Record<PriceStatsGranularity, number> = { day: 10, month: 7, year: 4 };

/** The period an instant belongs to, in Vietnam time. */
export function periodOf(instant: Date, granularity: PriceStatsGranularity): string {
  return todayInVietnam(instant).slice(0, PERIOD_LENGTH[granularity]);
}

/** The period `steps` periods after (or before, when negative) `period`. */
export function shiftPeriod(
  period: string,
  steps: number,
  granularity: PriceStatsGranularity,
): string {
  if (granularity === 'year') {
    return String(Number(period) + steps);
  }
  if (granularity === 'month') {
    const index = Number(period.slice(0, 4)) * 12 + (Number(period.slice(5, 7)) - 1) + steps;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  }
  const date = new Date(`${period}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + steps);
  return date.toISOString().slice(0, 10);
}

function change(close: number | null, previous: number | null) {
  if (close === null || previous === null) {
    return { amount: null, pct: null };
  }
  const amount = close - previous;
  const pct = Number(divideRounded(BigInt(amount) * 10_000n, BigInt(previous))) / 100;
  return { amount, pct };
}

/**
 * Closing prices and their change per period. The close of a period is its last snapshot by
 * sourceUpdatedAt; a period with no snapshot carries the previous close forward (hasData false),
 * because prices are only crawled when someone opens the app. `snapshots` may be in any order.
 */
export function priceStatsSeries(
  snapshots: PriceStatsSnapshot[],
  granularity: PriceStatsGranularity,
  now: Date,
): PriceStatsPointDto[] {
  const current = periodOf(now, granularity);
  const closes = new Map<string, PriceStatsSnapshot>();
  const sorted = [...snapshots].sort(
    (a, b) => Date.parse(a.sourceUpdatedAt) - Date.parse(b.sourceUpdatedAt),
  );
  for (const snapshot of sorted) {
    const period = periodOf(new Date(snapshot.sourceUpdatedAt), granularity);
    if (period <= current) {
      closes.set(period, snapshot); // later snapshots overwrite: the last one is the close
    }
  }

  const first = [...closes.keys()].sort()[0] ?? null;
  const windowStart =
    granularity === 'year'
      ? (first ?? current)
      : shiftPeriod(
          current,
          -((granularity === 'day' ? PRICE_STATS_DAY_COUNT : PRICE_STATS_MONTH_COUNT) - 1),
          granularity,
        );
  // Start at the first snapshot when it is older than the window, so the first shown period
  // has a previous close to compare with.
  const start = first !== null && first < windowStart ? first : windowStart;

  const points: PriceStatsPointDto[] = [];
  let previous: PriceStatsSnapshot | null = null;
  for (let period = start; period <= current; period = shiftPeriod(period, 1, granularity)) {
    const own = closes.get(period) ?? null;
    const close: PriceStatsSnapshot | null = own ?? previous;
    if (period >= windowStart) {
      const buy = change(close?.buyPrice ?? null, previous?.buyPrice ?? null);
      const sell = change(close?.sellPrice ?? null, previous?.sellPrice ?? null);
      points.push({
        period,
        hasData: own !== null,
        closeBuy: close?.buyPrice ?? null,
        closeSell: close?.sellPrice ?? null,
        changeBuy: buy.amount,
        changeSell: sell.amount,
        changeBuyPct: buy.pct,
        changeSellPct: sell.pct,
      });
    }
    previous = close;
  }
  return points;
}

/** The whole GET /prices/stats response. */
export function calculatePriceStats(snapshots: PriceStatsSnapshot[], now: Date): PriceStatsDto {
  const latest = snapshots.reduce<PriceStatsSnapshot | null>(
    (best, s) =>
      best === null || Date.parse(s.sourceUpdatedAt) > Date.parse(best.sourceUpdatedAt) ? s : best,
    null,
  );
  return {
    snapshotCount: snapshots.length,
    lastUpdatedAt: latest ? new Date(latest.sourceUpdatedAt).toISOString() : null,
    day: priceStatsSeries(snapshots, 'day', now),
    month: priceStatsSeries(snapshots, 'month', now),
    year: priceStatsSeries(snapshots, 'year', now),
  };
}
