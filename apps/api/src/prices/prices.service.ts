import type { PriceDto, PriceHistoryItemDto, RefreshTooSoonDto } from '@gold/shared';
import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PriceSnapshot } from '@prisma/client';
import { Clock } from '../common/clock';
import { bigintToNumber } from '../prisma/serialize';
import { PriceSnapshotStore } from './price-snapshot.store';
import { PricesConfig } from './prices.config';
import { PriceSource } from './sources/price-source';

export const GOLD_TYPE_CODE = 'NT_9999';

/**
 * The only place that decides when to crawl. One rule for both entry points: reuse the last
 * successful crawl for `ttlMs` (1 hour); after a failed crawl, wait `failureBackoffMs` before
 * trying again and serve the old snapshot meanwhile.
 */
@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  /** Shared by concurrent callers so they trigger at most one crawl. */
  private inFlight: Promise<PriceDto> | null = null;
  /** In memory: the API runs as a single instance. Reset on restart. */
  private lastFailure: { at: Date; message: string } | null = null;
  private goldTypeId: string | null = null;

  constructor(
    private readonly store: PriceSnapshotStore,
    private readonly source: PriceSource,
    private readonly clock: Clock,
    private readonly config: PricesConfig,
  ) {}

  /** On app open: the stored price if it is fresh enough, otherwise a new crawl. */
  getLatest(): Promise<PriceDto> {
    this.inFlight ??= this.resolveLatest().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** "Làm mới": crawl, but only once nextRefreshAt has passed. Otherwise 429. */
  async refresh(): Promise<PriceDto> {
    if (this.inFlight) {
      return this.inFlight;
    }
    const latest = await this.store.findLatest(await this.getGoldTypeId());
    const nextRefreshAt = this.nextRefreshAt(latest);
    if (this.clock.now() < nextRefreshAt) {
      const body: RefreshTooSoonDto = {
        statusCode: 429,
        message: 'Price was checked recently; refresh is not allowed yet',
        nextRefreshAt: nextRefreshAt.toISOString(),
      };
      throw new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
    }
    // Past nextRefreshAt, getLatest crawls (or joins a crawl that just started).
    return this.getLatest();
  }

  async getHistory(days: number): Promise<PriceHistoryItemDto[]> {
    const since = new Date(this.clock.now().getTime() - days * 24 * 60 * 60 * 1000);
    const snapshots = await this.store.findSince(await this.getGoldTypeId(), since);
    return snapshots.map((s) => ({
      buyPrice: bigintToNumber(s.buyPrice),
      sellPrice: bigintToNumber(s.sellPrice),
      sourceUpdatedAt: s.sourceUpdatedAt.toISOString(),
      checkedAt: s.checkedAt.toISOString(),
    }));
  }

  private async resolveLatest(): Promise<PriceDto> {
    const goldTypeId = await this.getGoldTypeId();
    const latest = await this.store.findLatest(goldTypeId);
    if (this.clock.now() < this.nextRefreshAt(latest)) {
      return this.toDto(latest as PriceSnapshot, this.lastFailure?.message ?? null);
    }
    return this.crawl(goldTypeId, latest);
  }

  private async crawl(goldTypeId: string, latest: PriceSnapshot | null): Promise<PriceDto> {
    const startedAt = this.clock.now();
    let quote;
    try {
      quote = await this.source.fetchQuote();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Price crawl failed: ${message}`);
      this.lastFailure = { at: startedAt, message };
      if (!latest) {
        throw new ServiceUnavailableException(`No price available yet: ${message}`);
      }
      return this.toDto(latest, message);
    }

    this.lastFailure = null;
    const { snapshot, outcome } = await this.store.recordQuote(goldTypeId, quote, startedAt);
    this.logger.log(`Price crawl ok (${outcome}): ${quote.buyPrice}/${quote.sellPrice}`);
    return this.toDto(snapshot, null);
  }

  /**
   * When the next crawl is allowed. A success clears lastFailure, so a recorded failure is always
   * newer than the last success: retry after the backoff. Otherwise, TTL after the last success.
   * With no snapshot and no failure, that is "now" (epoch).
   */
  private nextRefreshAt(latest: PriceSnapshot | null): Date {
    if (this.lastFailure) {
      return new Date(this.lastFailure.at.getTime() + this.config.failureBackoffMs);
    }
    return new Date(latest ? latest.checkedAt.getTime() + this.config.ttlMs : 0);
  }

  private toDto(snapshot: PriceSnapshot | null, refreshError: string | null): PriceDto {
    if (!snapshot) {
      throw new ServiceUnavailableException(`No price available yet: ${refreshError ?? 'unknown'}`);
    }
    const buyPrice = bigintToNumber(snapshot.buyPrice);
    const sellPrice = bigintToNumber(snapshot.sellPrice);
    const ageMs = this.clock.now().getTime() - snapshot.sourceUpdatedAt.getTime();
    return {
      buyPrice,
      sellPrice,
      spread: sellPrice - buyPrice,
      sourceUpdatedAt: snapshot.sourceUpdatedAt.toISOString(),
      checkedAt: snapshot.checkedAt.toISOString(),
      nextRefreshAt: this.nextRefreshAt(snapshot).toISOString(),
      isStale: ageMs > this.config.staleAfterMs,
      refreshError,
    };
  }

  private async getGoldTypeId(): Promise<string> {
    if (!this.goldTypeId) {
      const id = await this.store.findGoldTypeId(GOLD_TYPE_CODE);
      if (!id) {
        throw new InternalServerErrorException(
          `Gold type ${GOLD_TYPE_CODE} not found; run pnpm db:seed`,
        );
      }
      this.goldTypeId = id;
    }
    return this.goldTypeId;
  }
}
