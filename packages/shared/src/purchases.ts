import { z } from 'zod';
import { isIsoDate, todayInVietnam } from './dates';
import { QUANTITY_UNITS, QuantityError, toMilliChi, type QuantityUnit } from './quantity';

export const MIN_UNIT_PRICE = 1_000_000;
export const MAX_UNIT_PRICE = 100_000_000;
export const MAX_NOTE_LENGTH = 500;

const quantity = z.string().trim().min(1, 'Nhập số lượng');
const unit = z.enum(QUANTITY_UNITS);
const unitPrice = z
  .number()
  .int('Giá phải là số nguyên')
  .min(MIN_UNIT_PRICE, `Giá tối thiểu ${MIN_UNIT_PRICE.toLocaleString('vi-VN')}`)
  .max(MAX_UNIT_PRICE, `Giá tối đa ${MAX_UNIT_PRICE.toLocaleString('vi-VN')}`);
const purchasedAt = z
  .string()
  .refine(isIsoDate, 'Ngày không hợp lệ (YYYY-MM-DD)')
  // Evaluated on every parse, in Vietnam time: a UTC server must still accept "today" at 01:00 VN.
  .refine((date) => date <= todayInVietnam(), 'Ngày mua không được ở tương lai');
const note = z.string().trim().max(MAX_NOTE_LENGTH, `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự`);

function checkQuantity(
  value: { quantity?: string; unit?: QuantityUnit },
  ctx: z.RefinementCtx,
): void {
  if (value.quantity === undefined || value.unit === undefined) {
    return;
  }
  try {
    toMilliChi(value.quantity, value.unit);
  } catch (error) {
    if (!(error instanceof QuantityError)) throw error;
    ctx.addIssue({ code: 'custom', path: ['quantity'], message: error.message });
  }
}

export const createPurchaseSchema = z
  .object({
    quantity,
    unit,
    unitPrice,
    purchasedAt,
    note: note.optional(),
  })
  .strict()
  .superRefine(checkQuantity);

export const updatePurchaseSchema = z
  .object({
    quantity: quantity.optional(),
    unit: unit.optional(),
    unitPrice: unitPrice.optional(),
    purchasedAt: purchasedAt.optional(),
    /** null or "" clears the note. */
    note: note.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.quantity === undefined) !== (value.unit === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [value.quantity === undefined ? 'quantity' : 'unit'],
        message: 'quantity and unit must be sent together',
      });
    }
    if (Object.values(value).every((v) => v === undefined)) {
      ctx.addIssue({ code: 'custom', path: [], message: 'Nothing to update' });
    }
    checkQuantity(value, ctx);
  });

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

/** A purchase as returned by the API. */
export interface PurchaseDto {
  id: string;
  /** Decimal string in chỉ, e.g. "0.5". */
  quantityChi: string;
  /** VND per chỉ. */
  unitPrice: number;
  /** quantityChi × unitPrice, rounded half-up to whole đồng. */
  totalCost: number;
  /** YYYY-MM-DD. */
  purchasedAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
