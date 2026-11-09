import { formatPercent, formatVND, type PriceStatsPointDto } from '@gold/shared';
import { formatMillions, formatPeriod } from '@/lib/format';
import {
  LINE_HEIGHT,
  VIEW_WIDTH,
  areaPath,
  changeOf,
  changePctOf,
  closeOf,
  labelIndexes,
  linePath,
  priceScale,
  ticks,
  xAt,
  type PriceKind,
} from './chart-geometry';

const COLORS = { buy: '#d97706', sell: '#78716c' } as const; // amber-600, stone-500

export function changeTextColor(amount: number | null): string {
  if (amount === null || amount === 0) return 'text-stone-600';
  return amount > 0 ? 'text-emerald-700' : 'text-red-700';
}

export function arrow(amount: number | null): string {
  if (amount === null || amount === 0) return '';
  return amount > 0 ? '▲ ' : '▼ ';
}

/** Buy and sell close per period; the selected price is drawn bold with dots and a shaded area. */
export function PriceLineChart({
  points,
  kind,
  hover,
  onHover,
  showMissing,
}: {
  points: PriceStatsPointDto[];
  kind: PriceKind;
  hover: number;
  onHover: (index: number) => void;
  /** Explain hollow dots (day view: days nobody opened the app). */
  showMissing: boolean;
}) {
  const other: PriceKind = kind === 'buy' ? 'sell' : 'buy';
  const { lo, hi, y } = priceScale(points);
  const n = points.length;
  const hovered = points[hover];
  if (!hovered) return null;
  const hoveredClose = closeOf(hovered, kind);
  const left = xAt(hover, n) / 10; // % of the plot width
  const tipShift =
    left < 22 ? 'translate-x-3' : left > 78 ? '-translate-x-[calc(100%+12px)]' : '-translate-x-1/2';
  const change = changeOf(hovered, kind);
  const changePct = changePctOf(hovered, kind);

  return (
    <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="font-semibold text-stone-900">Diễn biến giá mua vào &amp; bán ra</h2>
        <ul
          aria-label="Chú thích"
          className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-stone-600"
        >
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.75 w-4 rounded-full bg-amber-600" />
            Mua vào
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.75 w-4 rounded-full bg-stone-500" />
            Bán ra
          </li>
          {showMissing && (
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full border-2 bg-white"
                style={{ borderColor: COLORS[kind] }}
              />
              Không có cập nhật (dùng giá trước)
            </li>
          )}
        </ul>
      </div>

      <div className="flex gap-2">
        <div aria-hidden="true" className="relative h-65 w-14 flex-none">
          {ticks(lo, hi).map((value) => (
            <span
              key={value}
              className="absolute right-0 -translate-y-1/2 text-xs whitespace-nowrap text-stone-500"
              style={{ top: `${(y(value) / LINE_HEIGHT) * 100}%` }}
            >
              {formatMillions(value)}
            </span>
          ))}
        </div>

        <div className="relative h-65 min-w-0 flex-1">
          {ticks(lo, hi).map((value) => (
            <div
              key={value}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-stone-200"
              style={{ top: `${(y(value) / LINE_HEIGHT) * 100}%` }}
            />
          ))}
          <svg
            role="img"
            aria-label={`Biểu đồ giá ${n} kỳ, chi tiết ở bảng bên dưới`}
            viewBox={`0 0 ${VIEW_WIDTH} ${LINE_HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <path d={areaPath(points, kind, y)} fill={COLORS[kind]} fillOpacity={0.1} />
            <path
              d={linePath(points, other, y)}
              fill="none"
              stroke={COLORS[other]}
              strokeWidth={1.75}
              strokeOpacity={0.85}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={linePath(points, kind, y)}
              fill="none"
              stroke={COLORS[kind]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 border-l border-stone-400"
            style={{ left: `${left}%` }}
          />
          {points.map((point, i) => {
            const close = closeOf(point, kind);
            if (close === null) return null;
            const size = i === hover ? 12 : n > 20 ? 8 : 10;
            return (
              <span
                key={point.period}
                aria-hidden="true"
                data-testid={point.hasData ? 'dot' : 'dot-missing'}
                className="pointer-events-none absolute box-border rounded-full border-2"
                style={{
                  left: `${xAt(i, n) / 10}%`,
                  top: `${(y(close) / LINE_HEIGHT) * 100}%`,
                  width: size,
                  height: size,
                  margin: `-${size / 2}px 0 0 -${size / 2}px`,
                  borderColor: COLORS[kind],
                  background: point.hasData ? COLORS[kind] : '#ffffff',
                }}
              />
            );
          })}

          {/* Pointer targets; keyboard and screen-reader users get the same data in the table. */}
          <div aria-hidden="true" className="absolute inset-0 flex">
            {points.map((point, i) => (
              <div
                key={point.period}
                className="h-full min-w-0 flex-1 cursor-crosshair"
                onPointerEnter={() => onHover(i)}
                onPointerDown={() => onHover(i)}
              />
            ))}
          </div>

          {hoveredClose !== null && (
            <div
              role="status"
              className={`pointer-events-none absolute top-1 z-10 min-w-50 rounded-xl bg-stone-900 px-3 py-2.5 text-xs text-stone-50 shadow-lg ${tipShift}`}
              style={{ left: `${left}%` }}
            >
              <p className="mb-1.5 font-semibold">{formatPeriod(hovered.period).full}</p>
              <p className="flex justify-between gap-4">
                <span className="text-stone-300">Mua vào</span>
                <span className="font-semibold">{formatVND(hovered.closeBuy ?? 0)}</span>
              </p>
              <p className="mt-0.5 flex justify-between gap-4">
                <span className="text-stone-300">Bán ra</span>
                <span className="font-semibold">{formatVND(hovered.closeSell ?? 0)}</span>
              </p>
              <p className="mt-1.5 flex justify-between gap-4">
                <span className="text-stone-300">So với kỳ trước</span>
                <span
                  className={`font-bold ${change === null || change === 0 ? 'text-stone-300' : change > 0 ? 'text-emerald-300' : 'text-red-300'}`}
                >
                  {changePct === null
                    ? '—'
                    : `${arrow(change)}${formatPercent(changePct, { sign: true })}`}
                </span>
              </p>
              {!hovered.hasData && (
                <p className="mt-1.5 text-[11px] text-stone-300">
                  Không có cập nhật · dùng giá gần nhất
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <XLabels points={points} />
    </section>
  );
}

export function XLabels({ points }: { points: PriceStatsPointDto[] }) {
  return (
    <div aria-hidden="true" className="relative ml-16 h-4.5">
      {labelIndexes(points.length).map((i) => {
        const point = points[i];
        if (!point) return null;
        return (
          <span
            key={point.period}
            className="absolute -translate-x-1/2 text-xs whitespace-nowrap text-stone-500"
            style={{ left: `${xAt(i, points.length) / 10}%` }}
          >
            {formatPeriod(point.period).short}
          </span>
        );
      })}
    </div>
  );
}
