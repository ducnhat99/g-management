import { getAppInfo } from '@gold/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './support/test-app';

describe('GET /health', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('returns {"status":"ok"} without a token', async () => {
    await request(t.app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('can import from @gold/shared', () => {
    expect(getAppInfo().name).toBe('gold-tracker');
  });
});
