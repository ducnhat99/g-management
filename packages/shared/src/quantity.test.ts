import { describe, expect, it } from 'vitest';
import { QuantityError, milliChiToString, toMilliChi, toQuantityChi } from './quantity';

describe('toMilliChi', () => {
  it.each([
    ['1', 'chi', 1000],
    ['0.5', 'chi', 500],
    ['0,5', 'chi', 500],
    ['0.285', 'chi', 285],
    ['0.001', 'chi', 1],
    ['0.5000', 'chi', 500],
    ['13', 'chi', 13_000],
    [' 2 ', 'chi', 2000],
    ['1', 'cay', 10_000],
    ['1.25', 'cay', 12_500],
    ['0.05', 'cay', 500],
    ['1.50', 'cay', 15_000],
  ] as const)('%j %s -> %d', (quantity, unit, milli) => {
    expect(toMilliChi(quantity, unit)).toBe(milli);
  });

  it('does not suffer float error (1.005 * 1000 is 1004.999… as a float)', () => {
    expect(1.005 * 1000).not.toBe(1005);
    expect(toMilliChi('1.005')).toBe(1005);
  });

  it.each([
    ['', 'chi'],
    ['abc', 'chi'],
    ['-1', 'chi'],
    ['1e3', 'chi'],
    ['1.2.3', 'chi'],
    ['0', 'chi'],
    ['0.000', 'chi'],
    ['0.0001', 'chi'],
    ['0.125', 'cay'],
    ['10001', 'chi'],
    ['1001', 'cay'],
  ] as const)('rejects %j %s', (quantity, unit) => {
    expect(() => toMilliChi(quantity, unit)).toThrow(QuantityError);
  });
});

describe('milliChiToString / toQuantityChi', () => {
  it.each([
    [500, '0.5'],
    [13_000, '13'],
    [285, '0.285'],
    [1, '0.001'],
    [12_500, '12.5'],
  ])('%d -> %s', (milli, text) => {
    expect(milliChiToString(milli)).toBe(text);
  });

  it('converts cây to a chỉ string', () => {
    expect(toQuantityChi('1.25', 'cay')).toBe('12.5');
    expect(toQuantityChi('2', 'cay')).toBe('20');
    expect(toQuantityChi('0,5', 'chi')).toBe('0.5');
  });
});
