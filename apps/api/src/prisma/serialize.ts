import type { Prisma } from '@prisma/client';

// JSON.stringify cannot handle BigInt or keep Decimal exact, so every response goes through these
// helpers in a DTO mapper. Do not patch BigInt.prototype.toJSON.

/** VND amounts are far below 2^53, but fail loudly rather than silently lose precision. */
export function bigintToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`BigInt ${value} is outside the safe integer range`);
  }
  return Number(value);
}

/** Plain decimal string without exponent notation, e.g. "0.5", "13". */
export function decimalToString(value: Prisma.Decimal): string {
  return value.toFixed();
}

/**
 * A Postgres DATE column comes back as a Date at 00:00 UTC. Read the UTC parts so the result does
 * not shift by a day with the server time zone.
 */
export function dateToIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
