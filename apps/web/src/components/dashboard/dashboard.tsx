'use client';

import { useState } from 'react';
import { canEditPurchases, type PortfolioSummaryDto } from '@gold/shared';
import { EyeIcon, PlusIcon } from '@/components/icons';
import { useSummary } from '@/lib/queries';
import { useDelayedFlag } from '@/lib/use-delayed-flag';
import { DeletePurchaseDialog } from './delete-purchase-dialog';
import { PriceCard } from './price-card';
import { PurchaseFormDialog } from './purchase-form-dialog';
import { PurchasesTable, type Lot } from './purchases-table';
import { SummaryCards } from './summary-cards';
import { WaitingRoom } from './waiting-room';

type Dialog = { kind: 'form'; lot: Lot | null; key: number } | { kind: 'delete'; lot: Lot } | null;

const OWN_PORTFOLIO: PortfolioSummaryDto['access'] = { role: 'owner', memberCount: 1 };

/** Loading longer than this (a sleeping API) opens the waiting-room game. */
export const SLOW_LOAD_MS = 1500;

export function Dashboard() {
  const summary = useSummary();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  // A new key per opening remounts the form, so it never shows the previous draft.
  const openForm = (lot: Lot | null) => setDialog({ kind: 'form', lot, key: Date.now() });
  const slow = useDelayedFlag(summary.isPending, SLOW_LOAD_MS);
  const [leftWaitingRoom, setLeftWaitingRoom] = useState(false);

  if (slow && !leftWaitingRoom) {
    return <WaitingRoom ready={!summary.isPending} onContinue={() => setLeftWaitingRoom(true)} />;
  }
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
  // `?? OWN_PORTFOLIO`: an API deployed before households existed sends no `access` (the web and
  // API hosts redeploy a few minutes apart).
  const access = summary.data.access ?? OWN_PORTFOLIO;
  const canEdit = canEditPurchases(access.role);
  const shared = access.memberCount > 1;
  return (
    <div className="space-y-6">
      <PriceCard price={price} priceError={priceError} />
      <SummaryCards totals={portfolio.totals} />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Giao dịch</h2>
            <p className="text-sm text-stone-500">
              {portfolio.lots.length > 0
                ? `${portfolio.lots.length} lần mua, mới nhất trước`
                : shared
                  ? 'Các lần mua vàng của gia đình'
                  : 'Các lần mua vàng của bạn'}
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => openForm(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-amber-600/20 transition hover:from-amber-600 hover:to-amber-700"
            >
              <PlusIcon className="size-4" />
              Thêm giao dịch
            </button>
          ) : (
            <span
              title="Chủ sở hữu có thể đổi quyền của bạn trong mục Thành viên"
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-600"
            >
              <EyeIcon className="size-4" />
              Chỉ xem
            </span>
          )}
        </div>
        <PurchasesTable
          lots={portfolio.lots}
          canEdit={canEdit}
          showCreatedBy={shared}
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
