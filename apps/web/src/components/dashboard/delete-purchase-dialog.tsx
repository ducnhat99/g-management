'use client';

import { formatChi, formatVND } from '@gold/shared';
import { AlertIcon, TrashIcon } from '@/components/icons';
import { Modal } from '@/components/modal';
import { formatDateVN } from '@/lib/format';
import { useDeletePurchase } from '@/lib/queries';
import type { Lot } from './purchases-table';

export function DeletePurchaseDialog({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const remove = useDeletePurchase();

  async function confirm() {
    try {
      await remove.mutateAsync(lot.id);
      onClose();
    } catch {
      // Shown below from remove.error.
    }
  }

  return (
    <Modal
      open
      title="Xóa giao dịch?"
      description="Không thể hoàn tác sau khi xóa."
      icon={
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"
        >
          <TrashIcon className="size-5" />
        </span>
      }
      onClose={onClose}
    >
      <p className="sr-only">
        Xóa lần mua {formatChi(lot.quantityChi)} ngày {formatDateVN(lot.purchasedAt)} với giá{' '}
        {formatVND(lot.unitPrice)}/chỉ?
      </p>
      <dl aria-hidden="true" className="grid grid-cols-3 gap-3 rounded-xl bg-stone-50 p-4 text-sm">
        <div>
          <dt className="text-xs text-stone-500">Ngày mua</dt>
          <dd className="mt-0.5 font-medium text-stone-900">{formatDateVN(lot.purchasedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Số lượng</dt>
          <dd className="mt-0.5 font-medium text-stone-900">{formatChi(lot.quantityChi)}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Giá mua/chỉ</dt>
          <dd className="mt-0.5 font-medium text-stone-900 tabular-nums">
            {formatVND(lot.unitPrice)}
          </dd>
        </div>
      </dl>

      {remove.isError && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          Không xóa được: {remove.error.message}
        </p>
      )}

      <div className="mt-5 flex gap-2 sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-11 flex-1 rounded-lg border border-stone-300 px-5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:flex-none"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={remove.isPending}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-6 text-sm font-semibold text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
        >
          {remove.isPending ? (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent"
            />
          ) : (
            <TrashIcon className="size-4" />
          )}
          {remove.isPending ? 'Đang xóa…' : 'Xóa'}
        </button>
      </div>
    </Modal>
  );
}
