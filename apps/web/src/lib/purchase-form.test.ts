import type { PurchaseDto } from '@gold/shared';
import { describe, expect, it } from 'vitest';
import {
  emptyPurchaseForm,
  formatPriceInput,
  parsePriceInput,
  previewPurchase,
  purchaseFormFrom,
  toPurchasePayload,
  type PurchaseFormValues,
} from './purchase-form';

const TODAY = '2026-10-09';
const VALID: PurchaseFormValues = {
  quantity: '0,5',
  unit: 'chi',
  unitPrice: '13.350.000',
  purchasedAt: '2026-10-01',
  note: '',
};

describe('formatPriceInput / parsePriceInput', () => {
  it.each([
    ['13240000', '13.240.000'],
    ['13.240.000', '13.240.000'],
    ['13.2400', '132.400'],
    ['abc', ''],
    ['', ''],
    ['0013', '13'],
    ['13 240 000 đ', '13.240.000'],
  ])('%j -> %j', (typed, shown) => {
    expect(formatPriceInput(typed)).toBe(shown);
  });

  it('parses the displayed text back to a number', () => {
    expect(parsePriceInput('13.240.000')).toBe(13_240_000);
    expect(parsePriceInput('')).toBeNull();
  });
});

describe('toPurchasePayload', () => {
  it('builds the API body: "." decimal, numeric price, no empty note', () => {
    expect(toPurchasePayload(VALID, 'create')).toEqual({
      ok: true,
      data: { quantity: '0.5', unit: 'chi', unitPrice: 13_350_000, purchasedAt: '2026-10-01' },
    });
  });

  it('keeps a note, trimmed', () => {
    const result = toPurchasePayload({ ...VALID, note: '  Nhẫn cưới ' }, 'create');
    expect(result.ok && result.data.note).toBe('Nhẫn cưới');
  });

  it('sends note: null on edit to clear it', () => {
    const result = toPurchasePayload(VALID, 'edit');
    expect(result.ok && result.data).toMatchObject({ quantity: '0.5', unit: 'chi', note: null });
  });

  it('reports every missing field in Vietnamese', () => {
    const result = toPurchasePayload(emptyPurchaseForm(''), 'create');
    expect(result).toEqual({
      ok: false,
      errors: expect.objectContaining({
        quantity: 'Nhập số lượng',
        unitPrice: 'Nhập giá mua',
        purchasedAt: 'Chọn ngày mua',
      }),
    });
  });

  it('uses the shared schema rules (price range, decimals for cây, future date)', () => {
    expect(toPurchasePayload({ ...VALID, unitPrice: '500.000' }, 'create')).toMatchObject({
      ok: false,
      errors: { unitPrice: expect.stringContaining('tối thiểu') },
    });
    expect(toPurchasePayload({ ...VALID, quantity: '0,125', unit: 'cay' }, 'create')).toMatchObject(
      {
        ok: false,
        errors: { quantity: expect.stringContaining('thập phân') },
      },
    );
    expect(toPurchasePayload({ ...VALID, purchasedAt: '2099-01-01' }, 'create')).toMatchObject({
      ok: false,
      errors: { purchasedAt: expect.stringContaining('tương lai') },
    });
  });
});

describe('purchaseFormFrom', () => {
  it('prefills the edit form in chỉ with Vietnamese formatting', () => {
    const purchase: PurchaseDto = {
      id: 'p1',
      quantityChi: '12.5',
      unitPrice: 13_000_000,
      totalCost: 162_500_000,
      purchasedAt: '2026-06-01',
      note: null,
      createdBy: null,
      createdAt: '',
      updatedAt: '',
    };
    expect(purchaseFormFrom(purchase)).toEqual({
      quantity: '12,5',
      unit: 'chi',
      unitPrice: '13.000.000',
      purchasedAt: '2026-06-01',
      note: '',
    });
  });
});

describe('previewPurchase', () => {
  it('estimates cost and profit/loss with the shared calculation', () => {
    expect(previewPurchase(VALID, 13_240_000, TODAY)).toMatchObject({
      cost: 6_675_000,
      value: 6_620_000,
      pnl: -55_000,
      pnlPct: -0.82,
    });
  });

  it('converts cây', () => {
    const preview = previewPurchase({ ...VALID, quantity: '1', unit: 'cay' }, null, TODAY);
    expect(preview).toMatchObject({ cost: 133_500_000, pnl: null });
  });

  it('is null while the form is incomplete or invalid', () => {
    expect(previewPurchase({ ...VALID, quantity: '' }, 13_240_000, TODAY)).toBeNull();
    expect(previewPurchase({ ...VALID, unitPrice: '' }, 13_240_000, TODAY)).toBeNull();
    expect(previewPurchase({ ...VALID, quantity: 'abc' }, 13_240_000, TODAY)).toBeNull();
  });
});
