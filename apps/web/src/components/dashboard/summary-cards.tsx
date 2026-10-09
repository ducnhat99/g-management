import { formatPercent, formatVND, type PortfolioTotals } from '@gold/shared';
import type { ReactNode } from 'react';
import { formatSignedVND, pnlColor } from '@/lib/format';

function Card({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-stone-600">{label}</p>
      <div className="mt-1 text-xl font-semibold tabular-nums">{children}</div>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export function SummaryCards({ totals }: { totals: PortfolioTotals }) {
  const { pnl, pnlPct } = totals;
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Tổng quan">
      <Card label="Tổng vàng">{totals.quantityLabel}</Card>
      <Card
        label="Tổng vốn"
        hint={
          totals.avgCostPerChi !== null &&
          `Hòa vốn khi mua vào ${formatVND(totals.avgCostPerChi)}/chỉ`
        }
      >
        {formatVND(totals.cost)}
      </Card>
      <Card label="Giá trị hiện tại">{totals.value === null ? '—' : formatVND(totals.value)}</Card>
      <Card label="Lời/lỗ" hint="Tính theo giá tiệm mua vào">
        {pnl === null ? (
          '—'
        ) : (
          <span className={pnlColor(pnl)}>
            {formatSignedVND(pnl)}
            {pnlPct !== null && (
              <span className="ml-1 text-base">({formatPercent(pnlPct, { sign: true })})</span>
            )}
          </span>
        )}
      </Card>
    </section>
  );
}
