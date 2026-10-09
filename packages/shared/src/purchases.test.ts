import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPurchaseSchema, updatePurchaseSchema } from './purchases';

const VALID = {
  quantity: '0.5',
  unit: 'chi',
  unitPrice: 13_350_000,
  purchasedAt: '2026-10-09',
  note: 'Mua ở Ngọc Thịnh Hải Châu',
};

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('createPurchaseSchema', () => {
  beforeEach(() => {
    // 01:00 on 2026-10-09 in Vietnam, still 2026-10-08 in UTC.
    vi.useFakeTimers({ now: new Date('2026-10-08T18:00:00Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a valid purchase', () => {
    expect(createPurchaseSchema.parse(VALID)).toEqual(VALID);
  });

  it('accepts today in Vietnam even when UTC is still yesterday', () => {
    expect(createPurchaseSchema.safeParse(VALID).success).toBe(true);
  });

  it('rejects a date in the future (Vietnam time)', () => {
    const result = createPurchaseSchema.safeParse({ ...VALID, purchasedAt: '2026-10-10' });
    expect(issuePaths(result)).toEqual(['purchasedAt']);
  });

  it.each([
    [{ quantity: '0' }, 'quantity'],
    [{ quantity: 'abc' }, 'quantity'],
    [{ quantity: '0.125', unit: 'cay' }, 'quantity'],
    [{ unit: 'luong' }, 'unit'],
    [{ unitPrice: 999_999 }, 'unitPrice'],
    [{ unitPrice: 100_000_001 }, 'unitPrice'],
    [{ unitPrice: 13_350_000.5 }, 'unitPrice'],
    [{ unitPrice: '13350000' }, 'unitPrice'],
    [{ purchasedAt: '2026-02-31' }, 'purchasedAt'],
    [{ note: 'x'.repeat(501) }, 'note'],
    [{ userId: 'someone-else' }, ''],
  ])('rejects %j', (patch, path) => {
    const result = createPurchaseSchema.safeParse({ ...VALID, ...patch });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(path);
  });

  it('requires every field except note', () => {
    const { note: _note, ...withoutNote } = VALID;
    expect(createPurchaseSchema.safeParse(withoutNote).success).toBe(true);
    expect(createPurchaseSchema.safeParse({ ...VALID, quantity: undefined }).success).toBe(false);
  });
});

describe('updatePurchaseSchema', () => {
  it('accepts a partial update', () => {
    expect(updatePurchaseSchema.parse({ unitPrice: 13_000_000 })).toEqual({
      unitPrice: 13_000_000,
    });
  });

  it('accepts null to clear the note', () => {
    expect(updatePurchaseSchema.parse({ note: null })).toEqual({ note: null });
  });

  it('requires quantity and unit together', () => {
    expect(updatePurchaseSchema.safeParse({ quantity: '1' }).success).toBe(false);
    expect(updatePurchaseSchema.safeParse({ unit: 'cay' }).success).toBe(false);
    expect(updatePurchaseSchema.safeParse({ quantity: '1', unit: 'cay' }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updatePurchaseSchema.safeParse({}).success).toBe(false);
  });
});
