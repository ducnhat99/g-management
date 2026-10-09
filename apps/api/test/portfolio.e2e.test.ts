import { randomUUID } from 'node:crypto';
import type { PortfolioSummaryDto, PriceDto } from '@gold/shared';
import { ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './support/test-app';

const ALICE = randomUUID();
const BOB = randomUUID();

const PRICE: PriceDto = {
  buyPrice: 13_240_000,
  sellPrice: 13_350_000,
  spread: 110_000,
  sourceUpdatedAt: '2026-10-07T02:06:00.000Z',
  checkedAt: '2026-10-09T03:00:00.000Z',
  nextRefreshAt: '2026-10-09T04:00:00.000Z',
  isStale: false,
  refreshError: null,
};

describe('GET /portfolio/summary', () => {
  let t: TestApp;
  let aliceToken: string;

  const summary = async (token: string) => {
    const res = await request(t.app.getHttpServer())
      .get('/portfolio/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body as PortfolioSummaryDto;
  };
  const buy = (token: string, body: object) =>
    request(t.app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

  beforeAll(async () => {
    t = await createTestApp();
    aliceToken = await t.tokenFor(ALICE);
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(() => {
    t.store.rows = [];
    t.prices.getLatest.mockReset().mockResolvedValue(PRICE);
  });

  it('requires a token', async () => {
    await request(t.app.getHttpServer()).get('/portfolio/summary').expect(401);
  });

  it('returns the price and the plan’s hand-checked profit/loss', async () => {
    await buy(aliceToken, {
      quantity: '5',
      unit: 'chi',
      unitPrice: 12_000_000,
      purchasedAt: '2026-01-15',
    });
    await buy(aliceToken, {
      quantity: '0.3',
      unit: 'cay',
      unitPrice: 13_000_000,
      purchasedAt: '2026-06-01',
      note: 'Nhẫn cưới',
    });

    const body = await summary(aliceToken);
    expect(t.prices.getLatest).toHaveBeenCalledTimes(1);
    expect(body.price).toEqual(PRICE);
    expect(body.priceError).toBeNull();
    expect(body.portfolio.totals).toEqual({
      quantityChi: '8',
      quantityLabel: '8 chỉ',
      cost: 99_000_000,
      avgCostPerChi: 12_375_000,
      value: 105_920_000,
      pnl: 6_920_000,
      pnlPct: 6.99,
    });
    // Newest purchase first, carrying the purchase fields the dashboard needs.
    expect(body.portfolio.lots.map((l) => [l.purchasedAt, l.note, l.pnl, l.pnlPct])).toEqual([
      ['2026-06-01', 'Nhẫn cưới', 720_000, 1.85],
      ['2026-01-15', null, 6_200_000, 10.33],
    ]);
    expect(body.portfolio.lots[0]).toHaveProperty('id');
    expect(body.portfolio.lots[0]?.holdingDays).toBeGreaterThan(0);
  });

  it("only includes the caller's purchases", async () => {
    await buy(await t.tokenFor(BOB), {
      quantity: '1',
      unit: 'cay',
      unitPrice: 12_000_000,
      purchasedAt: '2026-01-15',
    });
    const body = await summary(aliceToken);
    expect(body.portfolio.lots).toEqual([]);
    expect(body.portfolio.totals.cost).toBe(0);
  });

  it('still answers 200 with cost only when no price is available', async () => {
    t.prices.getLatest.mockRejectedValue(
      new ServiceUnavailableException('No price available yet: HTTP 503'),
    );
    await buy(aliceToken, {
      quantity: '5',
      unit: 'chi',
      unitPrice: 12_000_000,
      purchasedAt: '2026-01-15',
    });

    const body = await summary(aliceToken);
    expect(body.price).toBeNull();
    expect(body.priceError).toBe('No price available yet: HTTP 503');
    expect(body.portfolio.totals).toMatchObject({ cost: 60_000_000, value: null, pnl: null });
  });

  it('passes the stale-price warning through untouched', async () => {
    const stale = { ...PRICE, refreshError: 'Timed out', isStale: true };
    t.prices.getLatest.mockResolvedValue(stale);
    const body = await summary(aliceToken);
    expect(body.price).toEqual(stale);
  });

  it('does not hide unexpected errors', async () => {
    t.prices.getLatest.mockRejectedValue(new Error('database down'));
    await request(t.app.getHttpServer())
      .get('/portfolio/summary')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(500);
  });
});
