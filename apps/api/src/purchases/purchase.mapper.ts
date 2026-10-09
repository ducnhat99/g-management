import { costOf, toMilliChi, type PurchaseDto } from '@gold/shared';
import type { Purchase } from '@prisma/client';
import { bigintToNumber, dateToIsoDate, decimalToString } from '../prisma/serialize';

export function toPurchaseDto(purchase: Purchase): PurchaseDto {
  const quantityChi = decimalToString(purchase.quantityChi);
  const unitPrice = bigintToNumber(purchase.unitPrice);
  return {
    id: purchase.id,
    quantityChi,
    unitPrice,
    totalCost: costOf(toMilliChi(quantityChi), unitPrice),
    purchasedAt: dateToIsoDate(purchase.purchasedAt),
    note: purchase.note,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}
