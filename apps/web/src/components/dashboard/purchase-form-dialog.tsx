'use client';

import { formatPercent, formatVND, MAX_NOTE_LENGTH, todayInVietnam } from '@gold/shared';
import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/modal';
import { ApiError } from '@/lib/api-client';
import { formatSignedVND, pnlColor } from '@/lib/format';
import {
  emptyPurchaseForm,
  formatPriceInput,
  previewPurchase,
  purchaseFormFrom,
  toPurchasePayload,
  type PurchaseFormErrors,
  type PurchaseFormField,
  type PurchaseFormValues,
} from '@/lib/purchase-form';
import { useCreatePurchase, useUpdatePurchase } from '@/lib/queries';
import type { Lot } from './purchases-table';

const inputClass =
  'mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none aria-invalid:border-red-500';

/** Maps the API's `{ issues: [{ path, message }] }` 400 body onto form fields. */
function errorsFromApi(error: unknown): PurchaseFormErrors {
  if (error instanceof ApiError && error.status === 400) {
    const issues = (error.body as { issues?: { path: string; message: string }[] } | null)?.issues;
    if (issues?.length) {
      return Object.fromEntries(issues.map((i) => [i.path.split('.')[0] || 'form', i.message]));
    }
  }
  return { form: error instanceof Error ? error.message : 'Không lưu được, thử lại.' };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-xs text-red-700">
      {message}
    </p>
  ) : null;
}

/**
 * Add (lot = null) or edit a purchase. Mounted fresh each time it opens, so its state always starts
 * from `lot` or an empty form dated today.
 */
export function PurchaseFormDialog({
  lot,
  buyPrice,
  onClose,
}: {
  lot: Lot | null;
  buyPrice: number | null;
  onClose: () => void;
}) {
  const [today] = useState(() => todayInVietnam());
  const [values, setValues] = useState<PurchaseFormValues>(() =>
    lot ? purchaseFormFrom(lot) : emptyPurchaseForm(today),
  );
  const [errors, setErrors] = useState<PurchaseFormErrors>({});
  const create = useCreatePurchase();
  const update = useUpdatePurchase();
  const pending = create.isPending || update.isPending;
  const preview = previewPurchase(values, buyPrice, today);

  const set = (field: PurchaseFormField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (lot) {
        const payload = toPurchasePayload(values, 'edit');
        if (!payload.ok) return setErrors(payload.errors);
        await update.mutateAsync({ id: lot.id, body: payload.data });
      } else {
        const payload = toPurchasePayload(values, 'create');
        if (!payload.ok) return setErrors(payload.errors);
        await create.mutateAsync(payload.data);
      }
      onClose();
    } catch (error) {
      setErrors(errorsFromApi(error));
    }
  }

  const invalid = (field: PurchaseFormField) => (errors[field] ? true : undefined);
  const describedBy = (field: PurchaseFormField) => (errors[field] ? `${field}-error` : undefined);

  return (
    <Modal open title={lot ? 'Sửa giao dịch' : 'Thêm giao dịch'} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="quantity" className="text-sm font-medium">
            Số lượng
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="quantity"
              name="quantity"
              inputMode="decimal"
              autoComplete="off"
              placeholder={values.unit === 'cay' ? 'VD: 1 hoặc 0,5' : 'VD: 5 hoặc 0,5'}
              value={values.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              aria-invalid={invalid('quantity')}
              aria-describedby={describedBy('quantity')}
              className={`${inputClass} mt-0`}
            />
            <div
              role="group"
              aria-label="Đơn vị"
              className="flex shrink-0 rounded-md border border-stone-300 p-0.5"
            >
              {(['chi', 'cay'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={values.unit === unit}
                  onClick={() => set('unit', unit)}
                  className="rounded px-3 text-sm aria-pressed:bg-amber-600 aria-pressed:text-white"
                >
                  {unit === 'chi' ? 'chỉ' : 'cây'}
                </button>
              ))}
            </div>
          </div>
          <FieldError id="quantity-error" message={errors.quantity ?? errors.unit} />
        </div>

        <div>
          <label htmlFor="unitPrice" className="text-sm font-medium">
            Giá mua (VNĐ/chỉ)
          </label>
          <input
            id="unitPrice"
            name="unitPrice"
            inputMode="numeric"
            autoComplete="off"
            placeholder="VD: 13.350.000"
            value={values.unitPrice}
            onChange={(e) => set('unitPrice', formatPriceInput(e.target.value))}
            aria-invalid={invalid('unitPrice')}
            aria-describedby={describedBy('unitPrice')}
            className={inputClass}
          />
          <FieldError id="unitPrice-error" message={errors.unitPrice} />
        </div>

        <div>
          <label htmlFor="purchasedAt" className="text-sm font-medium">
            Ngày mua
          </label>
          <input
            id="purchasedAt"
            name="purchasedAt"
            type="date"
            max={today}
            value={values.purchasedAt}
            onChange={(e) => set('purchasedAt', e.target.value)}
            aria-invalid={invalid('purchasedAt')}
            aria-describedby={describedBy('purchasedAt')}
            className={inputClass}
          />
          <FieldError id="purchasedAt-error" message={errors.purchasedAt} />
        </div>

        <div>
          <label htmlFor="note" className="text-sm font-medium">
            Ghi chú <span className="font-normal text-stone-500">(không bắt buộc)</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={MAX_NOTE_LENGTH}
            value={values.note}
            onChange={(e) => set('note', e.target.value)}
            aria-invalid={invalid('note')}
            aria-describedby={describedBy('note')}
            className={inputClass}
          />
          <FieldError id="note-error" message={errors.note} />
        </div>

        <div className="rounded-md bg-stone-50 p-3 text-sm" aria-live="polite">
          {preview ? (
            <dl className="space-y-1">
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">Tổng tiền</dt>
                <dd className="font-medium tabular-nums">{formatVND(preview.cost)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">Lời/lỗ ước tính</dt>
                <dd className="font-medium tabular-nums">
                  {preview.pnl === null ? (
                    'Chưa có giá để ước tính'
                  ) : (
                    <span className={pnlColor(preview.pnl)}>
                      {formatSignedVND(preview.pnl)}
                      {preview.pnlPct !== null &&
                        ` (${formatPercent(preview.pnlPct, { sign: true })})`}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-stone-500">Nhập số lượng và giá để xem tổng tiền.</p>
          )}
        </div>

        {errors.form && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.form}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {pending ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
