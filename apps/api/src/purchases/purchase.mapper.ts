import { costOf, toMilliChi, type PurchaseDto } from '@gold/shared';
import type { Purchase } from '@prisma/client';
import { bigintToNumber, dateToIsoDate, decimalToString } from '../prisma/serialize';

/** `memberEmails` maps userId -> email of the household's members (for `createdBy`). */
export function toPurchaseDto(purchase: Purchase, memberEmails: Map<string, string>): PurchaseDto {
  const quantityChi = decimalToString(purchase.quantityChi);
  const unitPrice = bigintToNumber(purchase.unitPrice);
  return {
    id: purchase.id,
    quantityChi,
    unitPrice,
    totalCost: costOf(toMilliChi(quantityChi), unitPrice),
    purchasedAt: dateToIsoDate(purchase.purchasedAt),
    note: purchase.note,
    createdBy: memberEmails.get(purchase.userId) || null,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}
