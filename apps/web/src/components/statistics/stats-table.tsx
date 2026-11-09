import { formatPercent, formatVND, type PriceStatsPointDto } from '@gold/shared';
import { useState } from 'react';
import { formatPeriod, formatSignedVND } from '@/lib/format';
import { changeOf, changePctOf, type PriceKind } from './chart-geometry';
import { arrow, changeTextColor } from './price-line-chart';

const PAGE = 10;
const UNIT = { day: 'ngày', month: 'tháng', year: 'năm' } as const;

/** Every period, newest first; the first 10 until "Xem thêm". Periods before any data are left out. */
export function StatsTable({
  points,
  kind,
  granularity,
}: {
  points: PriceStatsPointDto[];
  kind: PriceKind;
  granularity: keyof typeof UNIT;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = points.filter((p) => p.closeBuy !== null).reverse();
  const visible = showAll ? rows : rows.slice(0, PAGE);

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 sm:px-5">
        <h2 className="font-semibold text-stone-900">Chi tiết theo {UNIT[granularity]}</h2>
        <span className="text-xs text-stone-500">
          Thay đổi tính theo {kind === 'buy' ? 'giá mua vào' : 'giá bán ra'}
        </span>
      </div>
      {/* Phones: two short lines per period, so nothing scrolls sideways. */}
      <ul
        aria-label={`Chi tiết theo ${UNIT[granularity]}`}
        className="divide-y divide-stone-200 md:hidden"
      >
        {visible.map((point) => {
          const change = changeOf(point, kind);
          const pct = changePctOf(point, kind);
          const color = changeTextColor(change);
          return (
            <li key={point.period} className="px-4 py-3 text-sm tabular-nums">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-stone-900">
                  {formatPeriod(point.period).full}
                </span>
                <span className={`font-semibold whitespace-nowrap ${color}`}>
                  {pct === null ? '—' : `${arrow(change)}${formatPercent(pct, { sign: true })}`}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-stone-600">
                <span>
                  Mua {formatVND(point.closeBuy ?? 0)} · Bán {formatVND(point.closeSell ?? 0)}
                </span>
                <span className={`whitespace-nowrap ${color}`}>
                  {change === null ? '—' : formatSignedVND(change)}
                </span>
              </div>
              {!point.hasData && (
                <span className="mt-1.5 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
                  Không có cập nhật
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Tablets and up: a table that fits the card width. */}
      <div className="hidden md:block">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-stone-500">
              <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">
                Kỳ
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Mua vào
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Bán ra
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Thay đổi
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((point) => {
              const change = changeOf(point, kind);
              const pct = changePctOf(point, kind);
              const color = changeTextColor(change);
              return (
                <tr key={point.period} className="border-t border-stone-200 text-stone-800">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal sm:px-5">
                    <span className="whitespace-nowrap">{formatPeriod(point.period).full}</span>
                    {!point.hasData && (
                      <span className="ml-2 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[11px] whitespace-nowrap text-stone-600">
                        Không có cập nhật
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {formatVND(point.closeBuy ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {formatVND(point.closeSell ?? 0)}
                  </td>
                  <td className={`px-3 py-2.5 text-right whitespace-nowrap ${color}`}>
                    {change === null ? '—' : formatSignedVND(change)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap sm:px-5 ${color}`}
                  >
                    {pct === null ? '—' : `${arrow(change)}${formatPercent(pct, { sign: true })}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE && (
        <div className="border-t border-stone-200 px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="min-h-10 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
          >
            {showAll ? 'Thu gọn' : `Xem thêm ${rows.length - PAGE} ${UNIT[granularity]}`}
          </button>
        </div>
      )}
    </section>
  );
}
