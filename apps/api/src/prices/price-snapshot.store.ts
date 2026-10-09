import { Injectable, Logger } from '@nestjs/common';
import type { PriceSnapshot } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PriceQuote } from './sources/price-source';

/** What happened to the stored snapshots after a successful crawl. */
export type RecordOutcome =
  | 'created' // new sourceUpdatedAt
  | 'checked' // same sourceUpdatedAt and same prices: only checkedAt moved
  | 'price-corrected'; // same sourceUpdatedAt but the site changed the prices

/** Persistence for price snapshots. Abstract so PricesService tests can use an in-memory fake. */
export abstract class PriceSnapshotStore {
  abstract findGoldTypeId(code: string): Promise<string | null>;
  /** The snapshot from the most recent successful crawl. */
  abstract findLatest(goldTypeId: string): Promise<PriceSnapshot | null>;
  abstract recordQuote(
    goldTypeId: string,
    quote: PriceQuote,
    checkedAt: Date,
  ): Promise<{ snapshot: PriceSnapshot; outcome: RecordOutcome }>;
  /** Snapshots whose source time is at or after `since`, oldest first. */
  abstract findSince(goldTypeId: string, since: Date): Promise<PriceSnapshot[]>;
}

@Injectable()
export class PrismaPriceSnapshotStore extends PriceSnapshotStore {
  private readonly logger = new Logger(PrismaPriceSnapshotStore.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findGoldTypeId(code: string): Promise<string | null> {
    const goldType = await this.prisma.goldType.findUnique({
      where: { code },
      select: { id: true },
    });
    return goldType?.id ?? null;
  }

  findLatest(goldTypeId: string): Promise<PriceSnapshot | null> {
    return this.prisma.priceSnapshot.findFirst({
      where: { goldTypeId },
      orderBy: { checkedAt: 'desc' },
    });
  }

  async recordQuote(
    goldTypeId: string,
    quote: PriceQuote,
    checkedAt: Date,
  ): Promise<{ snapshot: PriceSnapshot; outcome: RecordOutcome }> {
    const buyPrice = BigInt(quote.buyPrice);
    const sellPrice = BigInt(quote.sellPrice);
    const key = { goldTypeId, sourceUpdatedAt: quote.sourceUpdatedAt };

    const existing = await this.prisma.priceSnapshot.findUnique({
      where: { goldTypeId_sourceUpdatedAt: key },
    });
    if (!existing) {
      const snapshot = await this.prisma.priceSnapshot.create({
        data: { ...key, buyPrice, sellPrice, fetchedAt: checkedAt, checkedAt },
      });
      return { snapshot, outcome: 'created' };
    }

    const priceChanged = existing.buyPrice !== buyPrice || existing.sellPrice !== sellPrice;
    if (priceChanged) {
      this.logger.warn(
        `Prices changed without a new source time (${quote.sourceUpdatedAt.toISOString()}): ` +
          `${existing.buyPrice}/${existing.sellPrice} -> ${buyPrice}/${sellPrice}`,
      );
    }
    const snapshot = await this.prisma.priceSnapshot.update({
      where: { id: existing.id },
      data: priceChanged ? { buyPrice, sellPrice, checkedAt } : { checkedAt },
    });
    return { snapshot, outcome: priceChanged ? 'price-corrected' : 'checked' };
  }

  findSince(goldTypeId: string, since: Date): Promise<PriceSnapshot[]> {
    return this.prisma.priceSnapshot.findMany({
      where: { goldTypeId, sourceUpdatedAt: { gte: since } },
      orderBy: { sourceUpdatedAt: 'asc' },
    });
  }
}
