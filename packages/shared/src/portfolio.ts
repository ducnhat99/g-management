import { costOf } from './money';
import type { MemberRole } from './household';
import type { PriceDto } from './prices';
import type { PurchaseDto } from './purchases';
import { milliChiToString, toMilliChi } from './quantity';

/** One purchase as input to the calculation. */
export interface PortfolioLotInput {
  id: string;
  /** Decimal string in chỉ, e.g. "0.5". */
  quantityChi: string;
  /** Price paid, VND per chỉ. */
  unitPrice: number;
  /** YYYY-MM-DD. */
  purchasedAt: string;
}

export interface LotMetrics {
  /** quantity × price paid. */
  cost: number;
  /** quantity × current buy price; null without a price. */
  value: number | null;
  /** value − cost; null without a price. */
  pnl: number | null;
  /** pnl / cost × 100, 2 decimals; null without a price. */
  pnlPct: number | null;
  /** Calendar days from purchasedAt to today (0 on the purchase day). */
  holdingDays: number;
}

/** The input lot (with any extra fields it carries, e.g. a PurchaseDto's note) plus its metrics. */
export type PortfolioLot<T extends PortfolioLotInput = PortfolioLotInput> = T & LotMetrics;

export interface PortfolioTotals {
  /** Decimal string in chỉ. */
  quantityChi: string;
  /** e.g. "1 cây 3 chỉ". */
  quantityLabel: string;
  cost: number;
  /** cost / quantity, VND per chỉ: also the break-even buy price. null when empty. */
  avgCostPerChi: number | null;
  value: number | null;
  pnl: number | null;
  /** null when empty or without a price. */
  pnlPct: number | null;
}

export interface PortfolioResult<T extends PortfolioLotInput = PortfolioLotInput> {
  totals: PortfolioTotals;
  lots: PortfolioLot<T>[];
}

/** Response of GET /portfolio/summary. Lots are the user's purchases plus their metrics. */
export interface PortfolioSummaryDto {
  /** null when no price has ever been fetched and the crawl failed. */
  price: PriceDto | null;
  /** Why price is null. */
  priceError: string | null;
  portfolio: PortfolioResult<PurchaseDto>;
  /** The signed-in user's place in the household, so the UI can hide what they may not do. */
  access: { role: MemberRole; memberCount: number };
}

/** a / b rounded half away from zero (so -0.825 -> -0.83, like +0.825 -> +0.83). */
function divideRounded(a: bigint, b: bigint): bigint {
  const negative = a < 0n !== b < 0n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;
  const rounded = (2n * absA + absB) / (2n * absB);
  return negative ? -rounded : rounded;
}

/** pnl / cost × 100 with 2 decimals, e.g. 6.99. */
function percent(pnl: number, cost: number): number {
  return Number(divideRounded(BigInt(pnl) * 10_000n, BigInt(cost))) / 100;
}

function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((Date.parse(toIsoDate) - Date.parse(fromIsoDate)) / 86_400_000);
}

/**
 * Profit/loss of every lot and of the whole portfolio, valued at the shop's BUY price (what the
 * shop would pay you today). Integer math only: quantities as thousandths of a chỉ, each lot's
 * cost and value rounded half-up to whole đồng, totals = sums of the rounded lot figures so the
 * table always adds up.
 */
export function calculatePortfolio<T extends PortfolioLotInput>(
  lots: T[],
  buyPrice: number | null,
  today: string,
): PortfolioResult<T> {
  let totalMilli = 0;
  let totalCost = 0;
  let totalValue = 0;

  const resultLots = lots.map((lot): PortfolioLot<T> => {
    const milli = toMilliChi(lot.quantityChi);
    const cost = costOf(milli, lot.unitPrice);
    const value = buyPrice === null ? null : costOf(milli, buyPrice);
    const pnl = value === null ? null : value - cost;
    totalMilli += milli;
    totalCost += cost;
    totalValue += value ?? 0;
    return {
      ...lot,
      cost,
      value,
      pnl,
      pnlPct: pnl === null ? null : percent(pnl, cost),
      holdingDays: daysBetween(lot.purchasedAt, today),
    };
  });

  const hasLots = lots.length > 0;
  const value = buyPrice === null ? null : totalValue;
  const pnl = value === null ? null : value - totalCost;
  const quantityChi = milliChiToString(totalMilli);
  return {
    totals: {
      quantityChi,
      quantityLabel: formatChi(quantityChi),
      cost: totalCost,
      avgCostPerChi: hasLots
        ? Number(divideRounded(BigInt(totalCost) * 1000n, BigInt(totalMilli)))
        : null,
      value,
      pnl,
      pnlPct: hasLots && pnl !== null ? percent(pnl, totalCost) : null,
    },
    lots: resultLots,
  };
}

const vndFormat = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

/** 13240000 -> "13.240.000 ₫". */
export function formatVND(amount: number): string {
  return vndFormat.format(amount);
}

const decimalFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

/** 13 -> "1 cây 3 chỉ", 10 -> "1 cây", 0.5 -> "0,5 chỉ", "12.5" -> "1 cây 2,5 chỉ". */
export function formatChi(quantityChi: string | number): string {
  const milli = Number(quantityChi) === 0 ? 0 : toMilliChi(String(quantityChi));
  const cay = Math.floor(milli / 10_000);
  const restChi = Number(milliChiToString(milli % 10_000));
  const parts = [
    ...(cay > 0 ? [`${cay} cây`] : []),
    ...(restChi > 0 || cay === 0 ? [`${decimalFormat.format(restChi)} chỉ`] : []),
  ];
  return parts.join(' ');
}

/** 6.99 -> "6,99%"; with sign: "+6,99%" / "-0,82%". */
export function formatPercent(pct: number, { sign = false } = {}): string {
  const text = `${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(pct))}%`;
  if (pct < 0) return `-${text}`;
  return sign && pct > 0 ? `+${text}` : text;
}
