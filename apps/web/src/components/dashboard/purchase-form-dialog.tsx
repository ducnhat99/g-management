'use client';

import { formatPercent, formatVND, MAX_NOTE_LENGTH, todayInVietnam } from '@gold/shared';
import { useState, type FormEvent } from 'react';
import { AlertIcon, PencilIcon, PlusIcon } from '@/components/icons';
import { Modal } from '@/components/modal';
import { ApiError } from '@/lib/api-client';
import { formatDateVN, formatSignedVND, pnlColor } from '@/lib/format';
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

const labelClass = 'mb-1.5 block text-sm font-medium text-stone-700';
const inputClass =
  'block h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-stone-900 placeholder:text-stone-400 transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:outline-none aria-invalid:border-red-400 aria-invalid:focus:ring-red-100';

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
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
      <AlertIcon className="size-3.5 shrink-0" />
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
    <Modal
      open
      title={lot ? 'Sửa giao dịch' : 'Thêm giao dịch'}
      description={
        lot ? `Lần mua ngày ${formatDateVN(lot.purchasedAt)}` : 'Nhập một lần mua nhẫn trơn 9999'
      }
      icon={
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"
        >
          {lot ? <PencilIcon className="size-5" /> : <PlusIcon className="size-5" />}
        </span>
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="quantity" className={labelClass}>
            Số lượng
          </label>
          <div className="flex gap-2">
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
              className={inputClass}
            />
            <div
              role="group"
              aria-label="Đơn vị"
              className="flex h-11 shrink-0 rounded-lg bg-stone-100 p-1"
            >
              {(['chi', 'cay'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={values.unit === unit}
                  onClick={() => set('unit', unit)}
                  className="rounded-md px-3.5 text-sm font-medium text-stone-500 transition hover:text-stone-800 aria-pressed:bg-white aria-pressed:text-amber-700 aria-pressed:shadow-sm"
                >
                  {unit === 'chi' ? 'chỉ' : 'cây'}
                </button>
              ))}
            </div>
          </div>
          <FieldError id="quantity-error" message={errors.quantity ?? errors.unit} />
        </div>

        <div>
          <label htmlFor="unitPrice" className={labelClass}>
            Giá mua (VNĐ/chỉ)
          </label>
          <div className="relative">
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
              className={`${inputClass} pr-16 tabular-nums`}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-400"
            >
              ₫/chỉ
            </span>
          </div>
          <FieldError id="unitPrice-error" message={errors.unitPrice} />
        </div>

        <div>
          <label htmlFor="purchasedAt" className={labelClass}>
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
          <label htmlFor="note" className={labelClass}>
            Ghi chú <span className="font-normal text-stone-400">(không bắt buộc)</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={MAX_NOTE_LENGTH}
            placeholder="VD: Mua ở chi nhánh Hải Châu"
            value={values.note}
            onChange={(e) => set('note', e.target.value)}
            aria-invalid={invalid('note')}
            aria-describedby={describedBy('note')}
            className={`${inputClass} h-auto resize-none py-2.5`}
          />
          <FieldError id="note-error" message={errors.note} />
        </div>

        <div
          className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm"
          aria-live="polite"
        >
          {preview ? (
            <dl className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-stone-600">Tổng tiền</dt>
                <dd className="text-base font-semibold text-stone-900 tabular-nums">
                  {formatVND(preview.cost)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-t border-amber-200/70 pt-2">
                <dt className="text-stone-600">Lời/lỗ ước tính</dt>
                <dd className="font-semibold tabular-nums">
                  {preview.pnl === null ? (
                    <span className="font-normal text-stone-500">Chưa có giá để ước tính</span>
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
            <p className="text-center text-stone-500">Nhập số lượng và giá để xem tổng tiền.</p>
          )}
        </div>

        {errors.form && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {errors.form}
          </p>
        )}

        <div className="flex gap-2 pt-1 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-lg border border-stone-300 px-5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:flex-none"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-linear-to-r from-amber-500 to-amber-600 px-6 text-sm font-semibold text-white shadow-md shadow-amber-600/20 transition hover:from-amber-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
          >
            {pending && (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent"
              />
            )}
            {pending ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
