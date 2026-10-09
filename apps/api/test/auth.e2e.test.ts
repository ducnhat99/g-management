import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { createTestApp, type TestApp } from './support/test-app';

const USER = randomUUID();

describe('SupabaseAuthGuard', () => {
  let t: TestApp;
  const get = (path: string, token?: string) => {
    const req = request(t.app.getHttpServer()).get(path);
    return token === undefined ? req : req.set('Authorization', `Bearer ${token}`);
  };

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('accepts a valid token', async () => {
    await get('/purchases', await t.tokenFor(USER)).expect(200);
  });

  it('rejects a request without a token', async () => {
    await get('/purchases').expect(401);
  });

  it('protects the price endpoints too', async () => {
    await get('/prices/latest').expect(401);
    await request(t.app.getHttpServer()).post('/prices/refresh').expect(401);
  });

  it('rejects a header that is not "Bearer <token>"', async () => {
    const token = await t.tokenFor(USER);
    await request(t.app.getHttpServer())
      .get('/purchases')
      .set('Authorization', `Token ${token}`)
      .expect(401);
  });

  it('rejects garbage', async () => {
    await get('/purchases', 'not-a-jwt').expect(401);
  });

  it('rejects a token signed by another key', async () => {
    await get('/purchases', await t.foreignToken(USER)).expect(401);
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    await get('/purchases', await t.tokenFor(USER, { iat: past - 3600, exp: past })).expect(401);
  });

  it('rejects a token from another Supabase project (iss)', async () => {
    const token = await t.tokenFor(USER, { iss: 'https://other-project.supabase.co/auth/v1' });
    await get('/purchases', token).expect(401);
  });

  it('rejects a token not meant for signed-in users (aud)', async () => {
    await get('/purchases', await t.tokenFor(USER, { aud: 'anon' })).expect(401);
  });

  it('rejects a token whose subject is not a user id', async () => {
    await get('/purchases', await t.tokenFor('service-account')).expect(401);
  });
});
