'use client';

import { formatChi, formatVND } from '@gold/shared';
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
    <Modal open title="Xóa giao dịch?" onClose={onClose}>
      <p className="text-sm text-stone-700">
        Xóa lần mua {formatChi(lot.quantityChi)} ngày {formatDateVN(lot.purchasedAt)} với giá{' '}
        {formatVND(lot.unitPrice)}/chỉ? Không thể hoàn tác.
      </p>
      {remove.isError && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Không xóa được: {remove.error.message}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={remove.isPending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {remove.isPending ? 'Đang xóa…' : 'Xóa'}
        </button>
      </div>
    </Modal>
  );
}
