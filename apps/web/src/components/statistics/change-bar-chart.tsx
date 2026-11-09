import { formatPercent, type PriceStatsPointDto } from '@gold/shared';
import { barMax, changePctOf, type PriceKind } from './chart-geometry';
import { XLabels } from './price-line-chart';

const GRANULARITY_LABEL = { day: 'ngày', month: 'tháng', year: 'năm' } as const;

/** Change % per period: green up, red down, a grey tick for no change or no update. */
export function ChangeBarChart({
  points,
  kind,
  granularity,
  hover,
  onHover,
}: {
  points: PriceStatsPointDto[];
  kind: PriceKind;
  granularity: keyof typeof GRANULARITY_LABEL;
  hover: number;
  onHover: (index: number) => void;
}) {
  const pcts = points.map((p) => changePctOf(p, kind));
  const max = barMax(pcts);
  const showLabels = points.length <= 13;
  const maxLabel = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(max);

  return (
    <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="font-semibold text-stone-900">
          Tỉ lệ tăng/giảm theo {GRANULARITY_LABEL[granularity]} ·{' '}
          {kind === 'buy' ? 'giá mua vào' : 'giá bán ra'}
        </h2>
        <ul aria-label="Chú thích" className="flex gap-4 text-xs text-stone-600">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-xs bg-emerald-600" />▲ Tăng
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-xs bg-red-600" />▼ Giảm
          </li>
        </ul>
      </div>

      <div className="flex gap-2">
        <div aria-hidden="true" className="relative h-50 w-14 flex-none text-xs text-stone-500">
          <span className="absolute top-0 right-0 -translate-y-1/2">+{maxLabel}%</span>
          <span className="absolute top-1/2 right-0 -translate-y-1/2">0%</span>
          <span className="absolute top-full right-0 -translate-y-1/2">-{maxLabel}%</span>
        </div>
        <div className="relative h-50 min-w-0 flex-1">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 border-t border-dashed border-stone-200"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 border-t border-stone-400"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-full border-t border-dashed border-stone-200"
          />
          <div
            role="img"
            aria-label={`Biểu đồ tỉ lệ tăng/giảm ${points.length} kỳ, chi tiết ở bảng bên dưới`}
            className="absolute inset-0 flex"
          >
            {points.map((point, i) => {
              const pct = changePctOf(point, kind);
              const height = pct === null ? 0 : (Math.abs(pct) / max) * 50;
              const up = pct !== null && pct >= 0;
              const color =
                pct === null || pct === 0
                  ? 'bg-stone-400'
                  : pct > 0
                    ? 'bg-emerald-600'
                    : 'bg-red-600';
              return (
                <div
                  key={point.period}
                  aria-hidden="true"
                  className={`relative h-full min-w-0 flex-1 cursor-pointer rounded-md ${i === hover ? 'bg-stone-500/10' : ''}`}
                  onPointerEnter={() => onHover(i)}
                  onPointerDown={() => onHover(i)}
                >
                  {pct !== null && (
                    <span
                      data-testid={pct > 0 ? 'bar-up' : pct < 0 ? 'bar-down' : 'bar-flat'}
                      className={`absolute rounded-[3px] ${points.length > 20 ? 'inset-x-[20%]' : 'inset-x-[24%]'} ${color}`}
                      style={{
                        [up ? 'bottom' : 'top']: '50%',
                        height: `max(2px, ${height}%)`,
                      }}
                    />
                  )}
                  {showLabels && pct !== null && (
                    <span
                      className={`absolute -inset-x-2 text-center text-[11px] font-semibold ${pct > 0 ? 'text-emerald-700' : pct < 0 ? 'text-red-700' : 'text-stone-600'}`}
                      style={{ [up ? 'bottom' : 'top']: `calc(${50 + height}% + 4px)` }}
                    >
                      {formatPercent(pct, { sign: true })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <XLabels points={points} />
      <p className="text-xs text-stone-500">
        Giá chốt kỳ = lần cập nhật cuối cùng trong kỳ (giờ Việt Nam). Tỉ lệ = (giá chốt − giá chốt
        kỳ trước) / giá chốt kỳ trước.
      </p>
    </section>
  );
}
