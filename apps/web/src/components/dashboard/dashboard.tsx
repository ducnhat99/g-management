'use client';

import { useState } from 'react';
import { useSummary } from '@/lib/queries';
import { DeletePurchaseDialog } from './delete-purchase-dialog';
import { PriceCard } from './price-card';
import { PurchaseFormDialog } from './purchase-form-dialog';
import { PurchasesTable, type Lot } from './purchases-table';
import { SummaryCards } from './summary-cards';

type Dialog = { kind: 'form'; lot: Lot | null; key: number } | { kind: 'delete'; lot: Lot } | null;

export function Dashboard() {
  const summary = useSummary();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  // A new key per opening remounts the form, so it never shows the previous draft.
  const openForm = (lot: Lot | null) => setDialog({ kind: 'form', lot, key: Date.now() });

  if (summary.isPending) {
    return <p className="text-stone-600">Đang tải…</p>;
  }
  if (summary.isError) {
    return (
      <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        <p>Không tải được dữ liệu: {summary.error.message}</p>
        <button
          type="button"
          onClick={() => summary.refetch()}
          className="mt-2 rounded-md border border-red-300 px-3 py-1 hover:bg-red-100"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const { price, priceError, portfolio } = summary.data;
  return (
    <div className="space-y-6">
      <PriceCard price={price} priceError={priceError} />
      <SummaryCards totals={portfolio.totals} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Giao dịch</h2>
          <button
            type="button"
            onClick={() => openForm(null)}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Thêm giao dịch
          </button>
        </div>
        <PurchasesTable
          lots={portfolio.lots}
          onEdit={(lot) => openForm(lot)}
          onDelete={(lot) => setDialog({ kind: 'delete', lot })}
        />
      </section>

      {dialog?.kind === 'form' && (
        <PurchaseFormDialog
          key={dialog.key}
          lot={dialog.lot}
          buyPrice={price?.buyPrice ?? null}
          onClose={close}
        />
      )}
      {dialog?.kind === 'delete' && <DeletePurchaseDialog lot={dialog.lot} onClose={close} />}
    </div>
  );
}
