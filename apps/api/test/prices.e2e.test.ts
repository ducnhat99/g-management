import type { PriceDto } from '@gold/shared';
import { HttpException, HttpStatus, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PricesController } from '../src/prices/prices.controller';
import { PricesService } from '../src/prices/prices.service';

const PRICE: PriceDto = {
  buyPrice: 13_260_000,
  sellPrice: 13_380_000,
  spread: 120_000,
  sourceUpdatedAt: '2026-10-09T02:15:00.000Z',
  checkedAt: '2026-10-09T07:00:00.000Z',
  nextRefreshAt: '2026-10-09T08:00:00.000Z',
  isStale: false,
  refreshError: null,
};

describe('PricesController (HTTP)', () => {
  let app: INestApplication;
  const prices = { getLatest: vi.fn(), refresh: vi.fn(), getHistory: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PricesController],
      providers: [{ provide: PricesService, useValue: prices }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('GET /prices/latest returns the price', async () => {
    prices.getLatest.mockResolvedValue(PRICE);
    await request(app.getHttpServer()).get('/prices/latest').expect(200).expect(PRICE);
  });

  it('POST /prices/refresh returns 200 with the new price', async () => {
    prices.refresh.mockResolvedValue(PRICE);
    await request(app.getHttpServer()).post('/prices/refresh').expect(200).expect(PRICE);
  });

  it('POST /prices/refresh passes the 429 body with nextRefreshAt through', async () => {
    const body = { statusCode: 429, message: 'too soon', nextRefreshAt: PRICE.nextRefreshAt };
    prices.refresh.mockRejectedValue(new HttpException(body, HttpStatus.TOO_MANY_REQUESTS));
    await request(app.getHttpServer()).post('/prices/refresh').expect(429).expect(body);
  });

  it('GET /prices/history defaults to 30 days', async () => {
    prices.getHistory.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/prices/history').expect(200).expect([]);
    expect(prices.getHistory).toHaveBeenCalledWith(30);
  });

  it('GET /prices/history?days=7 passes the number through', async () => {
    prices.getHistory.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/prices/history?days=7').expect(200);
    expect(prices.getHistory).toHaveBeenCalledWith(7);
  });

  it.each(['0', '366', 'abc', '-5'])('GET /prices/history?days=%s is a 400', async (days) => {
    await request(app.getHttpServer()).get(`/prices/history?days=${days}`).expect(400);
    expect(prices.getHistory).not.toHaveBeenCalled();
  });
});
