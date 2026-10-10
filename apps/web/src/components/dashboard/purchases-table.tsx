import {
  formatChi,
  formatPercent,
  formatVND,
  type PortfolioLot,
  type PurchaseDto,
} from '@gold/shared';
import { AppLogo } from '@/components/app-logo';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { formatDateVN, formatSignedVND, pnlColor } from '@/lib/format';

export type Lot = PortfolioLot<PurchaseDto>;

/** Profit/loss as a tinted badge: green profit, red loss. */
function Pnl({ lot }: { lot: Lot }) {
  if (lot.pnl === null) return <span className="text-stone-400">—</span>;
  const tint = lot.pnl > 0 ? 'bg-emerald-50' : lot.pnl < 0 ? 'bg-red-50' : 'bg-stone-100';
  return (
    <span
      className={`inline-flex flex-col items-end rounded-lg px-2 py-1 font-semibold ${tint} ${pnlColor(lot.pnl)}`}
    >
      {formatSignedVND(lot.pnl)}
      {lot.pnlPct !== null && (
        <span className="text-xs font-medium">{formatPercent(lot.pnlPct, { sign: true })}</span>
      )}
    </span>
  );
}

function Actions({
  lot,
  onEdit,
  onDelete,
}: {
  lot: Lot;
  onEdit: (lot: Lot) => void;
  onDelete: (lot: Lot) => void;
}) {
  const label = `giao dịch ngày ${formatDateVN(lot.purchasedAt)}`;
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => onEdit(lot)}
        aria-label={`Sửa ${label}`}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
      >
        <PencilIcon className="size-4" />
        Sửa
      </button>
      <button
        type="button"
        onClick={() => onDelete(lot)}
        aria-label={`Xóa ${label}`}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 hover:text-red-700"
      >
        <TrashIcon className="size-4" />
        Xóa
      </button>
    </div>
  );
}

export function PurchasesTable({
  lots,
  onEdit,
  onDelete,
}: {
  lots: Lot[];
  onEdit: (lot: Lot) => void;
  onDelete: (lot: Lot) => void;
}) {
  if (lots.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-amber-300 bg-white/70 px-6 py-10 text-center">
        <AppLogo className="size-14 opacity-90" />
        <p className="mt-3 max-w-xs text-stone-600">
          Chưa có giao dịch nào. Bấm “Thêm giao dịch” để nhập lần mua đầu tiên.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Phones: one card per purchase. */}
      <ul className="space-y-3 sm:hidden" aria-label="Giao dịch">
        {lots.map((lot) => (
          <li key={lot.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{formatChi(lot.quantityChi)}</p>
                <p className="text-xs text-stone-500">
                  {formatDateVN(lot.purchasedAt)} · {lot.holdingDays} ngày
                </p>
              </div>
              <div className="text-right font-medium tabular-nums">
                <Pnl lot={lot} />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm tabular-nums">
              <div>
                <dt className="text-xs text-stone-500">Giá mua/chỉ</dt>
                <dd>{formatVND(lot.unitPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Vốn</dt>
                <dd>{formatVND(lot.cost)}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-500">Giá trị</dt>
                <dd>{lot.value === null ? '—' : formatVND(lot.value)}</dd>
              </div>
            </dl>
            {lot.note && <p className="mt-2 text-sm text-stone-600">{lot.note}</p>}
            <div className="mt-2 border-t border-stone-100 pt-2">
              <Actions lot={lot} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablets and up: a table. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50/80 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
            <tr>
              <th className="px-4 py-3">Ngày mua</th>
              <th className="px-4 py-3">Số lượng</th>
              <th className="px-4 py-3 text-right">Giá mua/chỉ</th>
              <th className="px-4 py-3 text-right">Vốn</th>
              <th className="px-4 py-3 text-right">Giá trị</th>
              <th className="px-4 py-3 text-right">Lời/lỗ</th>
              <th className="px-4 py-3">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-stone-700 tabular-nums">
            {lots.map((lot) => (
              <tr key={lot.id} className="transition-colors hover:bg-amber-50/40">
                <td className="px-4 py-3 font-medium whitespace-nowrap text-stone-900">
                  {formatDateVN(lot.purchasedAt)}
                  <span className="block text-xs text-stone-500">{lot.holdingDays} ngày</span>
                </td>
                <td className="px-4 py-3">
                  {formatChi(lot.quantityChi)}
                  {lot.note && (
                    <span
                      className="block max-w-48 truncate text-xs text-stone-500"
                      title={lot.note}
                    >
                      {lot.note}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{formatVND(lot.unitPrice)}</td>
                <td className="px-4 py-3 text-right">{formatVND(lot.cost)}</td>
                <td className="px-4 py-3 text-right">
                  {lot.value === null ? '—' : formatVND(lot.value)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  <Pnl lot={lot} />
                </td>
                <td className="px-4 py-3">
                  <Actions lot={lot} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
