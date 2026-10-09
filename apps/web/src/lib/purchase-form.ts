import {
  calculatePortfolio,
  createPurchaseSchema,
  toQuantityChi,
  type CreatePurchaseInput,
  type LotMetrics,
  type PurchaseDto,
  type QuantityUnit,
  type UpdatePurchaseInput,
} from '@gold/shared';

/** What the form inputs hold, as typed by the user. */
export interface PurchaseFormValues {
  quantity: string;
  unit: QuantityUnit;
  /** Display text with thousands dots, e.g. "13.240.000". */
  unitPrice: string;
  /** YYYY-MM-DD (date input value). */
  purchasedAt: string;
  note: string;
}

export type PurchaseFormField = keyof PurchaseFormValues;
export type PurchaseFormErrors = Partial<Record<PurchaseFormField | 'form', string>>;

export function emptyPurchaseForm(today: string): PurchaseFormValues {
  return { quantity: '', unit: 'chi', unitPrice: '', purchasedAt: today, note: '' };
}

export function purchaseFormFrom(purchase: PurchaseDto): PurchaseFormValues {
  return {
    quantity: purchase.quantityChi.replace('.', ','),
    unit: 'chi',
    unitPrice: formatPriceInput(String(purchase.unitPrice)),
    purchasedAt: purchase.purchasedAt,
    note: purchase.note ?? '',
  };
}

/** Keeps the digits of what was typed and regroups them: "13240000" -> "13.240.000". */
export function formatPriceInput(text: string): string {
  const digits = text
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 12);
  return digits ? Number(digits).toLocaleString('vi-VN') : '';
}

export function parsePriceInput(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

type PayloadResult<T> = { ok: true; data: T } | { ok: false; errors: PurchaseFormErrors };

/**
 * Validates the form with the same zod schema the API uses. Quantity goes out with a "." decimal
 * point. For an edit every field is sent, and an empty note becomes null to clear it.
 */
export function toPurchasePayload(
  values: PurchaseFormValues,
  mode: 'create',
): PayloadResult<CreatePurchaseInput>;
export function toPurchasePayload(
  values: PurchaseFormValues,
  mode: 'edit',
): PayloadResult<UpdatePurchaseInput>;
export function toPurchasePayload(
  values: PurchaseFormValues,
  mode: 'create' | 'edit',
): PayloadResult<CreatePurchaseInput | UpdatePurchaseInput> {
  const errors: PurchaseFormErrors = {};
  const unitPrice = parsePriceInput(values.unitPrice);
  if (!values.quantity.trim()) errors.quantity = 'Nhập số lượng';
  if (unitPrice === null) errors.unitPrice = 'Nhập giá mua';
  if (!values.purchasedAt) errors.purchasedAt = 'Chọn ngày mua';

  const note = values.note.trim();
  const result = createPurchaseSchema.safeParse({
    quantity: values.quantity.trim().replace(',', '.'),
    unit: values.unit,
    unitPrice: unitPrice ?? 0,
    purchasedAt: values.purchasedAt,
    ...(note && { note }),
  });
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = (issue.path[0] as PurchaseFormField | undefined) ?? 'form';
      errors[field] ??= issue.message;
    }
  }
  if (Object.keys(errors).length > 0 || !result.success) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    data: mode === 'edit' ? { ...result.data, note: note || null } : result.data,
  };
}

/** Cost and estimated profit/loss of what is in the form, or null while it is incomplete. */
export function previewPurchase(
  values: PurchaseFormValues,
  buyPrice: number | null,
  today: string,
): LotMetrics | null {
  const unitPrice = parsePriceInput(values.unitPrice);
  if (unitPrice === null || !values.quantity.trim()) return null;
  try {
    const quantityChi = toQuantityChi(values.quantity, values.unit);
    const [lot] = calculatePortfolio(
      [{ id: 'preview', quantityChi, unitPrice, purchasedAt: values.purchasedAt || today }],
      buyPrice,
      today,
    ).lots;
    return lot ?? null;
  } catch {
    return null;
  }
}
