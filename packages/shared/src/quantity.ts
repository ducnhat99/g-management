// Quantities are handled as integer thousandths of a chỉ ("milli-chỉ") parsed from decimal strings.
// Never parseFloat a quantity: 1.005 * 1000 is 1004.9999999999999.

export const CHI_PER_CAY = 10;
export const QUANTITY_UNITS = ['chi', 'cay'] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

/** Largest quantity accepted, in chỉ (1.000 cây). Far below the Decimal(10,3) column limit. */
export const MAX_QUANTITY_CHI = 10_000;

/** Decimal places allowed per unit, so the result in chỉ has at most 3. */
const MAX_DECIMALS: Record<QuantityUnit, number> = { chi: 3, cay: 2 };
const MILLI_PER_UNIT: Record<QuantityUnit, number> = { chi: 1000, cay: 1000 * CHI_PER_CAY };

export class QuantityError extends Error {
  override readonly name = 'QuantityError';
}

/**
 * "0.5" chỉ -> 500, "1,25" cây -> 12500. Accepts "." or "," as the decimal separator. Throws
 * QuantityError for anything that is not a positive amount with few enough decimals.
 */
export function toMilliChi(quantity: string, unit: QuantityUnit = 'chi'): number {
  const text = quantity.trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new QuantityError('Số lượng không hợp lệ');
  }
  const [, whole = '', rawFraction = ''] = match;
  const fraction = rawFraction.replace(/0+$/, '');
  const decimals = MAX_DECIMALS[unit];
  if (fraction.length > decimals) {
    const unitName = unit === 'cay' ? 'cây' : 'chỉ';
    throw new QuantityError(`Tối đa ${decimals} chữ số thập phân khi nhập theo ${unitName}`);
  }
  const perUnit = MILLI_PER_UNIT[unit];
  // Digits of perUnit after the leading 1: 3 for chỉ, 4 for cây.
  const fractionMilli = Number(fraction.padEnd(String(perUnit).length - 1, '0'));
  const milli = Number(whole) * perUnit + fractionMilli;
  if (milli <= 0) {
    throw new QuantityError('Số lượng phải lớn hơn 0');
  }
  if (milli > MAX_QUANTITY_CHI * 1000) {
    throw new QuantityError(`Số lượng tối đa ${MAX_QUANTITY_CHI.toLocaleString('vi-VN')} chỉ`);
  }
  return milli;
}

/** 500 -> "0.5", 13000 -> "13", 285 -> "0.285". */
export function milliChiToString(milli: number): string {
  const whole = Math.floor(milli / 1000);
  const fraction = String(milli % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/** A user-entered quantity in either unit, as a canonical chỉ string for the API/DB. */
export function toQuantityChi(quantity: string, unit: QuantityUnit): string {
  return milliChiToString(toMilliChi(quantity, unit));
}
