import { formatPercent, formatVND, type PortfolioTotals } from '@gold/shared';
import type { ReactNode } from 'react';
import { CoinsIcon, ScaleIcon, TrendIcon, WalletIcon } from '@/components/icons';
import { formatSignedVND, pnlColor } from '@/lib/format';

type Tone = 'neutral' | 'profit' | 'loss';

const TONES: Record<Tone, { card: string; icon: string }> = {
  neutral: { card: 'border-stone-200 bg-white', icon: 'bg-amber-50 text-amber-600' },
  profit: { card: 'border-emerald-200 bg-emerald-50/60', icon: 'bg-emerald-100 text-emerald-700' },
  loss: { card: 'border-red-200 bg-red-50/60', icon: 'bg-red-100 text-red-700' },
};

/** The label <p> stays a direct child of the card root (tests read the card through it). */
function Card({
  label,
  icon,
  tone = 'neutral',
  children,
  hint,
}: {
  label: string;
  icon: ReactNode;
  tone?: Tone;
  children: ReactNode;
  hint?: ReactNode;
}) {
  const styles = TONES[tone];
  return (
    <div className={`relative rounded-2xl border p-4 shadow-sm sm:p-5 ${styles.card}`}>
      <span
        aria-hidden="true"
        className={`absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg sm:top-5 sm:right-5 ${styles.icon}`}
      >
        {icon}
      </span>
      <p className="pr-10 text-sm font-medium text-stone-600">{label}</p>
      <div className="mt-2 text-xl font-bold tracking-tight text-stone-900 tabular-nums sm:text-2xl">
        {children}
      </div>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export function SummaryCards({ totals }: { totals: PortfolioTotals }) {
  const { pnl, pnlPct } = totals;
  const tone: Tone = pnl === null || pnl === 0 ? 'neutral' : pnl > 0 ? 'profit' : 'loss';
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Tổng quan">
      <Card label="Tổng vàng" icon={<CoinsIcon className="size-4.5" />}>
        {totals.quantityLabel}
      </Card>
      <Card
        label="Tổng vốn"
        icon={<WalletIcon className="size-4.5" />}
        hint={
          totals.avgCostPerChi !== null &&
          `Giá mua trung bình ${formatVND(totals.avgCostPerChi)}/chỉ`
        }
      >
        {formatVND(totals.cost)}
      </Card>
      <Card label="Giá trị hiện tại" icon={<ScaleIcon className="size-4.5" />}>
        {totals.value === null ? '—' : formatVND(totals.value)}
      </Card>
      <Card
        label="Lời/lỗ"
        icon={<TrendIcon className="size-4.5" />}
        tone={tone}
        hint="Tính theo giá tiệm mua vào"
      >
        {pnl === null ? (
          '—'
        ) : (
          <span className={pnlColor(pnl)}>
            {formatSignedVND(pnl)}
            {pnlPct !== null && (
              <span className="block text-sm font-semibold">
                ({formatPercent(pnlPct, { sign: true })})
              </span>
            )}
          </span>
        )}
      </Card>
    </section>
  );
}
