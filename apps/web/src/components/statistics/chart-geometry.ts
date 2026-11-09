import type { PriceStatsPointDto } from '@gold/shared';

/** Which price the cards, bar chart and change column use. Buy is the default (profit/loss). */
export type PriceKind = 'buy' | 'sell';

export function closeOf(point: PriceStatsPointDto, kind: PriceKind): number | null {
  return kind === 'buy' ? point.closeBuy : point.closeSell;
}

export function changeOf(point: PriceStatsPointDto, kind: PriceKind): number | null {
  return kind === 'buy' ? point.changeBuy : point.changeSell;
}

export function changePctOf(point: PriceStatsPointDto, kind: PriceKind): number | null {
  return kind === 'buy' ? point.changeBuyPct : point.changeSellPct;
}

/** SVG user units; the SVG stretches to the box (preserveAspectRatio="none"). */
export const VIEW_WIDTH = 1000;
export const LINE_HEIGHT = 260;

/** Centre of slot `i` of `count`, so points line up with the bars below. */
export function xAt(index: number, count: number): number {
  return ((index + 0.5) / count) * VIEW_WIDTH;
}

/** Price range of both lines with 14 % headroom, and the matching y in SVG units. */
export function priceScale(points: PriceStatsPointDto[]) {
  const values = points.flatMap((p) => [p.closeBuy, p.closeSell]).filter((v) => v !== null);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = (hi - lo) * 0.14 || 100_000;
  lo -= pad;
  hi += pad;
  return { lo, hi, y: (value: number) => LINE_HEIGHT - ((value - lo) / (hi - lo)) * LINE_HEIGHT };
}

/** "M x y L x y …" through every known close. Unknown closes only come before the first one. */
export function linePath(
  points: PriceStatsPointDto[],
  kind: PriceKind,
  y: (value: number) => number,
): string {
  const parts: string[] = [];
  points.forEach((point, i) => {
    const close = closeOf(point, kind);
    if (close !== null) {
      parts.push(
        `${parts.length ? 'L' : 'M'}${xAt(i, points.length).toFixed(1)} ${y(close).toFixed(1)}`,
      );
    }
  });
  return parts.join(' ');
}

/** The line closed down to the bottom edge, for the shaded area. */
export function areaPath(
  points: PriceStatsPointDto[],
  kind: PriceKind,
  y: (value: number) => number,
): string {
  const known = points.map((p, i) => (closeOf(p, kind) === null ? -1 : i)).filter((i) => i >= 0);
  const firstIndex = known[0];
  const lastIndex = known.at(-1);
  if (firstIndex === undefined || lastIndex === undefined) return '';
  const first = xAt(firstIndex, points.length).toFixed(1);
  const last = xAt(lastIndex, points.length).toFixed(1);
  return `${linePath(points, kind, y)} L${last} ${LINE_HEIGHT} L${first} ${LINE_HEIGHT} Z`;
}

/** `count` evenly spaced values from hi down to lo. */
export function ticks(lo: number, hi: number, count = 5): number[] {
  return Array.from({ length: count }, (_, k) => hi - ((hi - lo) * k) / (count - 1));
}

/** About 7 x-axis labels, always including the newest period. */
export function labelIndexes(count: number): number[] {
  const step = Math.max(1, Math.ceil(count / 7));
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) out.unshift(i);
  return out;
}

/** Half-height of the bar chart in %: the largest |change %| reaches 1/1.2 of it. */
export function barMax(pcts: (number | null)[]): number {
  const known = pcts.filter((p) => p !== null).map(Math.abs);
  return Math.max(0.1, ...known) * 1.2;
}
