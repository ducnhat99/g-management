import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Purchase } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GOLD_TYPE_CODE } from '../prices/prices.service';

/** Normalized values to write. quantityChi is a canonical chỉ string, purchasedAt YYYY-MM-DD. */
export interface PurchaseWrite {
  quantityChi: string;
  unitPrice: number;
  purchasedAt: string;
  note: string | null;
}

/**
 * Purchases, always scoped to one user: a purchase owned by someone else behaves exactly like one
 * that does not exist. Abstract so e2e tests can run without a database.
 */
export abstract class PurchaseStore {
  /** Newest purchase date first. */
  abstract list(userId: string): Promise<Purchase[]>;
  abstract find(userId: string, id: string): Promise<Purchase | null>;
  abstract create(userId: string, data: PurchaseWrite): Promise<Purchase>;
  /** null when no such purchase belongs to the user. */
  abstract update(
    userId: string,
    id: string,
    data: Partial<PurchaseWrite>,
  ): Promise<Purchase | null>;
  /** false when no such purchase belongs to the user. */
  abstract delete(userId: string, id: string): Promise<boolean>;
}

/** A DATE column value: midnight UTC of that calendar day. */
const toDbDate = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

function toDbData(data: Partial<PurchaseWrite>) {
  return {
    ...(data.quantityChi !== undefined && { quantityChi: data.quantityChi }),
    ...(data.unitPrice !== undefined && { unitPrice: BigInt(data.unitPrice) }),
    ...(data.purchasedAt !== undefined && { purchasedAt: toDbDate(data.purchasedAt) }),
    ...(data.note !== undefined && { note: data.note }),
  };
}

@Injectable()
export class PrismaPurchaseStore extends PurchaseStore {
  private goldTypeId: string | null = null;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  list(userId: string): Promise<Purchase[]> {
    return this.prisma.purchase.findMany({
      where: { userId },
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  find(userId: string, id: string): Promise<Purchase | null> {
    return this.prisma.purchase.findFirst({ where: { id, userId } });
  }

  async create(userId: string, data: PurchaseWrite): Promise<Purchase> {
    return this.prisma.purchase.create({
      data: {
        userId,
        goldTypeId: await this.getGoldTypeId(),
        quantityChi: data.quantityChi,
        unitPrice: BigInt(data.unitPrice),
        purchasedAt: toDbDate(data.purchasedAt),
        note: data.note,
      },
    });
  }

  async update(userId: string, id: string, data: Partial<PurchaseWrite>): Promise<Purchase | null> {
    const { count } = await this.prisma.purchase.updateMany({
      where: { id, userId },
      data: toDbData(data),
    });
    return count === 0 ? null : this.find(userId, id);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.purchase.deleteMany({ where: { id, userId } });
    return count > 0;
  }

  private async getGoldTypeId(): Promise<string> {
    if (!this.goldTypeId) {
      const goldType = await this.prisma.goldType.findUnique({ where: { code: GOLD_TYPE_CODE } });
      if (!goldType) {
        throw new InternalServerErrorException(
          `Gold type ${GOLD_TYPE_CODE} not found; run pnpm db:seed`,
        );
      }
      this.goldTypeId = goldType.id;
    }
    return this.goldTypeId;
  }
}
