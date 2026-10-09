import {
  formatChi,
  formatPercent,
  formatVND,
  type PortfolioLot,
  type PurchaseDto,
} from '@gold/shared';
import { formatDateVN, formatSignedVND, pnlColor } from '@/lib/format';

export type Lot = PortfolioLot<PurchaseDto>;

function Pnl({ lot }: { lot: Lot }) {
  if (lot.pnl === null) return <span className="text-stone-400">—</span>;
  return (
    <span className={pnlColor(lot.pnl)}>
      {formatSignedVND(lot.pnl)}
      {lot.pnlPct !== null && (
        <span className="block text-xs">{formatPercent(lot.pnlPct, { sign: true })}</span>
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
        className="rounded px-2 py-1 text-sm text-stone-700 hover:bg-stone-100"
      >
        Sửa
      </button>
      <button
        type="button"
        onClick={() => onDelete(lot)}
        aria-label={`Xóa ${label}`}
        className="rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50"
      >
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
      <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-stone-600">
        Chưa có giao dịch nào. Bấm “Thêm giao dịch” để nhập lần mua đầu tiên.
      </p>
    );
  }

  return (
    <>
      {/* Phones: one card per purchase. */}
      <ul className="space-y-3 sm:hidden" aria-label="Giao dịch">
        {lots.map((lot) => (
          <li key={lot.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
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
      <div className="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-600">
            <tr>
              <th className="px-3 py-2 font-medium">Ngày mua</th>
              <th className="px-3 py-2 font-medium">Số lượng</th>
              <th className="px-3 py-2 text-right font-medium">Giá mua/chỉ</th>
              <th className="px-3 py-2 text-right font-medium">Vốn</th>
              <th className="px-3 py-2 text-right font-medium">Giá trị</th>
              <th className="px-3 py-2 text-right font-medium">Lời/lỗ</th>
              <th className="px-3 py-2">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 tabular-nums">
            {lots.map((lot) => (
              <tr key={lot.id}>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatDateVN(lot.purchasedAt)}
                  <span className="block text-xs text-stone-500">{lot.holdingDays} ngày</span>
                </td>
                <td className="px-3 py-2">
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
                <td className="px-3 py-2 text-right">{formatVND(lot.unitPrice)}</td>
                <td className="px-3 py-2 text-right">{formatVND(lot.cost)}</td>
                <td className="px-3 py-2 text-right">
                  {lot.value === null ? '—' : formatVND(lot.value)}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  <Pnl lot={lot} />
                </td>
                <td className="px-3 py-2">
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
