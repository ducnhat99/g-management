import { HttpException, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { PriceSnapshot } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../common/clock';
import { PriceSnapshotStore, type RecordOutcome } from './price-snapshot.store';
import { PricesConfig } from './prices.config';
import { PricesService } from './prices.service';
import { PriceFetchError, PriceSource, type PriceQuote } from './sources/price-source';

Logger.overrideLogger(false);

const GOLD_TYPE_ID = 'gold-type-1';
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const T0 = new Date('2026-10-09T03:00:00Z');

class FakeClock extends Clock {
  current = T0;
  now(): Date {
    return this.current;
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

class FakeStore extends PriceSnapshotStore {
  rows: PriceSnapshot[] = [];
  outcomes: RecordOutcome[] = [];

  async findGoldTypeId(code: string) {
    return code === 'NT_9999' ? GOLD_TYPE_ID : null;
  }

  async findLatest() {
    return [...this.rows].sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime())[0] ?? null;
  }

  async recordQuote(goldTypeId: string, quote: PriceQuote, checkedAt: Date) {
    const buyPrice = BigInt(quote.buyPrice);
    const sellPrice = BigInt(quote.sellPrice);
    const existing = this.rows.find(
      (r) => r.sourceUpdatedAt.getTime() === quote.sourceUpdatedAt.getTime(),
    );
    let outcome: RecordOutcome;
    if (!existing) {
      this.rows.push({
        id: `snap-${this.rows.length + 1}`,
        goldTypeId,
        buyPrice,
        sellPrice,
        sourceUpdatedAt: quote.sourceUpdatedAt,
        fetchedAt: checkedAt,
        checkedAt,
      });
      outcome = 'created';
    } else {
      outcome =
        existing.buyPrice !== buyPrice || existing.sellPrice !== sellPrice
          ? 'price-corrected'
          : 'checked';
      Object.assign(existing, { buyPrice, sellPrice, checkedAt });
    }
    this.outcomes.push(outcome);
    return { snapshot: (await this.findLatest()) as PriceSnapshot, outcome };
  }

  async findSince(_goldTypeId: string, since: Date) {
    return this.rows.filter((r) => r.sourceUpdatedAt >= since);
  }
}

const quote = (buy: number, sell: number, sourceUpdatedAt: string): PriceQuote => ({
  buyPrice: buy,
  sellPrice: sell,
  sourceUpdatedAt: new Date(sourceUpdatedAt),
});
const MORNING = quote(13_240_000, 13_340_000, '2026-10-09T09:15:00+07:00');

describe('PricesService', () => {
  let clock: FakeClock;
  let store: FakeStore;
  let fetchQuote: ReturnType<typeof vi.fn<() => Promise<PriceQuote>>>;
  let service: PricesService;

  beforeEach(() => {
    clock = new FakeClock();
    store = new FakeStore();
    fetchQuote = vi.fn<() => Promise<PriceQuote>>().mockResolvedValue(MORNING);
    const source: PriceSource = { fetchQuote };
    service = new PricesService(store, source, clock, new PricesConfig(HOUR, MINUTE));
  });

  describe('getLatest (app open)', () => {
    it('crawls when there is no snapshot yet', async () => {
      const price = await service.getLatest();
      expect(fetchQuote).toHaveBeenCalledTimes(1);
      expect(price).toMatchObject({
        buyPrice: 13_240_000,
        sellPrice: 13_340_000,
        spread: 100_000,
        sourceUpdatedAt: '2026-10-09T02:15:00.000Z',
        checkedAt: T0.toISOString(),
        refreshError: null,
        isStale: false,
      });
    });

    it('reuses the stored price within 1 hour of the last crawl', async () => {
      await service.getLatest();
      clock.advance(59 * MINUTE);
      const price = await service.getLatest();
      expect(fetchQuote).toHaveBeenCalledTimes(1);
      expect(price.checkedAt).toBe(T0.toISOString());
    });

    it('crawls again once the last crawl is 1 hour old', async () => {
      await service.getLatest();
      clock.advance(HOUR);
      const price = await service.getLatest();
      expect(fetchQuote).toHaveBeenCalledTimes(2);
      expect(price.checkedAt).toBe(clock.now().toISOString());
    });

    it('reports nextRefreshAt as 1 hour after the last crawl', async () => {
      const price = await service.getLatest();
      expect(price.nextRefreshAt).toBe(new Date(T0.getTime() + HOUR).toISOString());
    });

    it('shares one crawl between 5 concurrent requests', async () => {
      let release!: (q: PriceQuote) => void;
      fetchQuote.mockReturnValue(new Promise((resolve) => (release = resolve)));
      const pending = Array.from({ length: 5 }, () => service.getLatest());
      await vi.waitFor(() => expect(fetchQuote).toHaveBeenCalled());
      release(MORNING);
      const results = await Promise.all(pending);
      expect(fetchQuote).toHaveBeenCalledTimes(1);
      expect(new Set(results.map((r) => r.checkedAt)).size).toBe(1);
    });

    it('same source time and price: only checkedAt moves', async () => {
      await service.getLatest();
      clock.advance(HOUR);
      await service.getLatest();
      expect(store.rows).toHaveLength(1);
      expect(store.outcomes).toEqual(['created', 'checked']);
      expect(store.rows[0]?.checkedAt).toEqual(clock.now());
      expect(store.rows[0]?.fetchedAt).toEqual(T0);
    });

    it('same source time but new prices: updates that snapshot', async () => {
      await service.getLatest();
      clock.advance(HOUR);
      fetchQuote.mockResolvedValue(quote(13_260_000, 13_380_000, '2026-10-09T09:15:00+07:00'));
      const price = await service.getLatest();
      expect(store.rows).toHaveLength(1);
      expect(store.outcomes.at(-1)).toBe('price-corrected');
      expect(price.buyPrice).toBe(13_260_000);
    });

    it('new source time: creates a new snapshot', async () => {
      await service.getLatest();
      clock.advance(HOUR);
      fetchQuote.mockResolvedValue(quote(13_300_000, 13_420_000, '2026-10-09T10:30:00+07:00'));
      await service.getLatest();
      expect(store.rows).toHaveLength(2);
      expect(store.outcomes).toEqual(['created', 'created']);
    });

    it('marks a source time older than 24 hours as stale', async () => {
      fetchQuote.mockResolvedValue(quote(13_000_000, 13_100_000, '2026-10-08T02:00:00Z'));
      expect((await service.getLatest()).isStale).toBe(true);
    });
  });

  describe('when the crawl fails', () => {
    beforeEach(async () => {
      await service.getLatest(); // a good snapshot at T0
      clock.advance(HOUR);
      fetchQuote.mockRejectedValue(new PriceFetchError('HTTP 503 from ngocthinh'));
    });

    it('returns the old snapshot with refreshError', async () => {
      const price = await service.getLatest();
      expect(price.refreshError).toBe('HTTP 503 from ngocthinh');
      expect(price.checkedAt).toBe(T0.toISOString());
      expect(price.buyPrice).toBe(13_240_000);
    });

    it('waits 60 seconds before trying again, then retries', async () => {
      await service.getLatest();
      clock.advance(59 * 1000);
      const during = await service.getLatest();
      expect(fetchQuote).toHaveBeenCalledTimes(2);
      expect(during.refreshError).toBe('HTTP 503 from ngocthinh');
      expect(during.nextRefreshAt).toBe(new Date(T0.getTime() + HOUR + MINUTE).toISOString());

      clock.advance(1000);
      fetchQuote.mockResolvedValue(MORNING);
      const after = await service.getLatest();
      expect(fetchQuote).toHaveBeenCalledTimes(3);
      expect(after.refreshError).toBeNull();
      expect(after.checkedAt).toBe(clock.now().toISOString());
    });

    it('returns 503 when there is no snapshot at all', async () => {
      const fresh = new PricesService(
        new FakeStore(),
        { fetchQuote: vi.fn().mockRejectedValue(new PriceFetchError('down')) },
        clock,
        new PricesConfig(HOUR, MINUTE),
      );
      await expect(fresh.getLatest()).rejects.toBeInstanceOf(ServiceUnavailableException);
      // Still 503 (not a crash) during the backoff window.
      await expect(fresh.getLatest()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('refresh (Làm mới)', () => {
    it('crawls when there is no snapshot yet', async () => {
      await service.refresh();
      expect(fetchQuote).toHaveBeenCalledTimes(1);
    });

    it('is refused with 429 within 1 hour of the last crawl, without crawling', async () => {
      await service.getLatest();
      clock.advance(30 * MINUTE);
      const error = await service.refresh().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({
        statusCode: 429,
        nextRefreshAt: new Date(T0.getTime() + HOUR).toISOString(),
      });
      expect(fetchQuote).toHaveBeenCalledTimes(1);
    });

    it('crawls once the last crawl is 1 hour old', async () => {
      await service.getLatest();
      clock.advance(HOUR);
      const price = await service.refresh();
      expect(fetchQuote).toHaveBeenCalledTimes(2);
      expect(price.checkedAt).toBe(clock.now().toISOString());
    });

    it('after a failed crawl, is refused during the 60 second backoff, then allowed', async () => {
      await service.getLatest();
      clock.advance(HOUR);
      fetchQuote.mockRejectedValueOnce(new PriceFetchError('timeout'));
      await service.refresh();

      clock.advance(30 * 1000);
      await expect(service.refresh()).rejects.toBeInstanceOf(HttpException);

      clock.advance(30 * 1000);
      const price = await service.refresh();
      expect(price.refreshError).toBeNull();
      expect(fetchQuote).toHaveBeenCalledTimes(3);
    });
  });

  describe('getHistory', () => {
    it('returns snapshots from the last N days as numbers', async () => {
      fetchQuote.mockResolvedValue(quote(13_000_000, 13_100_000, '2026-09-01T02:00:00Z'));
      await service.getLatest();
      clock.advance(HOUR);
      fetchQuote.mockResolvedValue(MORNING);
      await service.getLatest();

      const history = await service.getHistory(30);
      expect(history).toEqual([
        {
          buyPrice: 13_240_000,
          sellPrice: 13_340_000,
          sourceUpdatedAt: '2026-10-09T02:15:00.000Z',
          checkedAt: clock.now().toISOString(),
        },
      ]);
    });
  });
});
