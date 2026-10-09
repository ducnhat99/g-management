/**
 * VND for `milliChi` thousandths of a chỉ at `pricePerChi`, rounded half-up to whole đồng.
 * BigInt keeps the intermediate product exact.
 */
export function costOf(milliChi: number, pricePerChi: number): number {
  return Number((BigInt(milliChi) * BigInt(pricePerChi) + 500n) / 1000n);
}
