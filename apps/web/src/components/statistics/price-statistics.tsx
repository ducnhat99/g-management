'use client';

import {
  formatPercent,
  formatVND,
  type PriceStatsDto,
  type PriceStatsGranularity,
  type PriceStatsPointDto,
} from '@gold/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ClockIcon, TrendIcon } from '@/components/icons';
import { formatDateTimeVN, formatPeriod, formatSignedVND } from '@/lib/format';
import { usePriceStats } from '@/lib/queries';
import { ChangeBarChart } from './change-bar-chart';
import { changeOf, changePctOf, closeOf, type PriceKind } from './chart-geometry';
import { PriceLineChart, arrow } from './price-line-chart';
import { StatsTable } from './stats-table';

const GRANULARITIES: { id: PriceStatsGranularity; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
];
const KINDS: { id: PriceKind; label: string }[] = [
  { id: 'buy', label: 'Giá mua vào' },
  { id: 'sell', label: 'Giá bán ra' },
];
const CARD_LABELS: Record<PriceStatsGranularity, string> = {
  day: 'Hôm nay so với hôm qua',
  month: 'Tháng này so với tháng trước',
  year: 'Năm nay so với năm trước',
};

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-1 rounded-xl bg-stone-200/60 p-1"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
          className="min-h-9 rounded-[9px] px-3.5 py-1.5 text-sm font-medium text-stone-600 transition hover:text-stone-900 aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:text-stone-900 aria-pressed:shadow-sm"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function rangeText(points: PriceStatsPointDto[], granularity: PriceStatsGranularity): string {
  const known = points.filter((p) => p.closeBuy !== null);
  const first = known[0] ?? points[0];
  const last = points.at(-1);
  if (!first || !last) return '';
  if (granularity === 'year') return `Từ ${first.period} đến nay`;
  const label = granularity === 'day' ? '30 ngày gần nhất' : '12 tháng gần nhất';
  return `${label} · ${formatPeriod(first.period).short} – ${formatPeriod(last.period).short}`;
}

function ChangeCard({
  label,
  point,
  kind,
}: {
  label: string;
  point: PriceStatsPointDto | undefined;
  kind: PriceKind;
}) {
  const change = point ? changeOf(point, kind) : null;
  const pct = point ? changePctOf(point, kind) : null;
  const close = point ? closeOf(point, kind) : null;
  const tone =
    change === null || change === 0
      ? {
          card: 'border-stone-200 bg-white',
          icon: 'bg-amber-50 text-amber-600',
          text: 'text-stone-900',
        }
      : change > 0
        ? {
            card: 'border-emerald-200 bg-emerald-50/60',
            icon: 'bg-emerald-100 text-emerald-700',
            text: 'text-emerald-700',
          }
        : {
            card: 'border-red-200 bg-red-50/60',
            icon: 'bg-red-100 text-red-700',
            text: 'text-red-700',
          };
  return (
    <div className={`relative rounded-2xl border p-4 shadow-sm sm:p-5 ${tone.card}`}>
      <span
        aria-hidden="true"
        className={`absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg sm:top-5 sm:right-5 ${tone.icon}`}
      >
        <TrendIcon className={`size-4.5 ${change !== null && change < 0 ? '-scale-y-100' : ''}`} />
      </span>
      <p className="pr-10 text-sm font-medium text-stone-600">{label}</p>
      <p className={`mt-2 text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${tone.text}`}>
        {pct === null ? '—' : `${arrow(change)}${formatPercent(pct, { sign: true })}`}
      </p>
      <p className="mt-1 text-xs text-stone-500">
        {change === null || close === null
          ? 'Chưa đủ dữ liệu'
          : `${formatSignedVND(change)}/chỉ · chốt ${formatVND(close)}`}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"
      >
        <TrendIcon className="size-7" />
      </span>
      <h2 className="text-lg font-semibold text-stone-900">Chưa đủ dữ liệu để thống kê</h2>
      <p className="max-w-md text-sm leading-relaxed text-stone-600">
        Cần ít nhất 2 lần cập nhật giá. Giá được lấy từ Ngọc Thịnh mỗi khi có người mở app, nên biểu
        đồ sẽ đầy dần theo thời gian.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-linear-to-r from-amber-500 to-amber-600 px-5 text-sm font-semibold text-white shadow-md shadow-amber-600/20 transition hover:from-amber-600 hover:to-amber-700"
      >
        Về Tổng quan
      </Link>
    </section>
  );
}

function StatsView({ stats }: { stats: PriceStatsDto }) {
  const [granularity, setGranularity] = useState<PriceStatsGranularity>('day');
  const [kind, setKind] = useState<PriceKind>('buy');
  const [hover, setHover] = useState<number | null>(null);
  const points = stats[granularity];
  const enough = stats.snapshotCount >= 2;
  const hoverIndex = hover !== null && hover < points.length ? hover : points.length - 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Thống kê giá</h1>
          <p className="mt-1 text-sm text-stone-600">Ngọc Thịnh · Nhẫn trơn 9999 · VNĐ/chỉ</p>
        </div>
        {stats.lastUpdatedAt && (
          <p className="inline-flex items-center gap-1.5 text-xs text-stone-500">
            <ClockIcon className="size-3.5" />
            Giá mới nhất: {formatDateTimeVN(stats.lastUpdatedAt)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Segmented
          label="Thống kê theo"
          options={GRANULARITIES}
          value={granularity}
          onChange={(value) => {
            setGranularity(value);
            setHover(null);
          }}
        />
        <Segmented label="Loại giá" options={KINDS} value={kind} onChange={setKind} />
        {enough && <span className="text-xs text-stone-500">{rangeText(points, granularity)}</span>}
      </div>

      <section aria-label="Tóm tắt" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {GRANULARITIES.map(({ id }) => (
          <ChangeCard
            key={id}
            label={CARD_LABELS[id]}
            point={enough ? stats[id].at(-1) : undefined}
            kind={kind}
          />
        ))}
      </section>

      {enough ? (
        <>
          <PriceLineChart
            points={points}
            kind={kind}
            hover={hoverIndex}
            onHover={setHover}
            showMissing={granularity === 'day'}
          />
          <ChangeBarChart
            points={points}
            kind={kind}
            granularity={granularity}
            hover={hoverIndex}
            onHover={setHover}
          />
          {/* Remount on a new granularity so "Xem thêm" starts collapsed. */}
          <StatsTable key={granularity} points={points} kind={kind} granularity={granularity} />
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

export function PriceStatistics() {
  const stats = usePriceStats();
  if (stats.isPending) {
    return <p className="text-stone-600">Đang tải…</p>;
  }
  if (stats.isError) {
    return (
      <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        <p>Không tải được thống kê: {stats.error.message}</p>
        <button
          type="button"
          onClick={() => stats.refetch()}
          className="mt-2 rounded-md border border-red-300 px-3 py-1 hover:bg-red-100"
        >
          Thử lại
        </button>
      </div>
    );
  }
  return <StatsView stats={stats.data} />;
}
