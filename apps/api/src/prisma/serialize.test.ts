import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { bigintToNumber, dateToIsoDate, decimalToString } from './serialize';

describe('bigintToNumber', () => {
  it('converts VND amounts exactly', () => {
    expect(bigintToNumber(13_240_000n)).toBe(13_240_000);
    expect(bigintToNumber(0n)).toBe(0);
  });

  it('throws outside the safe integer range', () => {
    expect(() => bigintToNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });

  it('makes the value JSON-serializable', () => {
    expect(JSON.stringify({ price: bigintToNumber(13_350_000n) })).toBe('{"price":13350000}');
  });
});

describe('decimalToString', () => {
  it('keeps fractional chỉ exact', () => {
    expect(decimalToString(new Prisma.Decimal('0.285'))).toBe('0.285');
    expect(decimalToString(new Prisma.Decimal('0.5'))).toBe('0.5');
  });

  it('drops trailing zeros from the DB scale', () => {
    expect(decimalToString(new Prisma.Decimal('13.000'))).toBe('13');
  });

  it('never uses exponent notation', () => {
    expect(decimalToString(new Prisma.Decimal('0.001'))).toBe('0.001');
    expect(decimalToString(new Prisma.Decimal('1e-7'))).toBe('0.0000001');
  });
});

describe('dateToIsoDate', () => {
  it('returns the calendar date of a DATE column value', () => {
    expect(dateToIsoDate(new Date('2026-10-09T00:00:00.000Z'))).toBe('2026-10-09');
  });
});
