import { randomUUID } from 'node:crypto';
import type { PurchaseDto } from '@gold/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './support/test-app';

const ALICE = randomUUID();
const BOB = randomUUID();

const FIRST = { quantity: '5', unit: 'chi', unitPrice: 12_000_000, purchasedAt: '2026-01-15' };
const SECOND = {
  quantity: '0.3',
  unit: 'cay',
  unitPrice: 13_000_000,
  purchasedAt: '2026-06-01',
  note: 'Nhẫn cưới',
};

describe('/purchases', () => {
  let t: TestApp;
  let aliceToken: string;
  let bobToken: string;

  const as = (token: string) => {
    const server = t.app.getHttpServer();
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      list: () => auth(request(server).get('/purchases')),
      get: (id: string) => auth(request(server).get(`/purchases/${id}`)),
      create: (body: object) => auth(request(server).post('/purchases').send(body)),
      update: (id: string, body: object) =>
        auth(request(server).patch(`/purchases/${id}`).send(body)),
      remove: (id: string) => auth(request(server).delete(`/purchases/${id}`)),
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    aliceToken = await t.tokenFor(ALICE);
    bobToken = await t.tokenFor(BOB);
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(() => {
    t.store.rows = [];
  });

  describe('CRUD', () => {
    it('creates a purchase and returns it with totalCost', async () => {
      const res = await as(aliceToken).create(FIRST).expect(201);
      expect(res.body).toMatchObject({
        quantityChi: '5',
        unitPrice: 12_000_000,
        totalCost: 60_000_000,
        purchasedAt: '2026-01-15',
        note: null,
      });
      expect(t.store.rows[0]?.userId).toBe(ALICE);
    });

    it('converts cây to chỉ before saving', async () => {
      const res = await as(aliceToken).create(SECOND).expect(201);
      expect(res.body).toMatchObject({
        quantityChi: '3',
        totalCost: 39_000_000,
        note: 'Nhẫn cưới',
      });
    });

    it('lists purchases newest purchase date first', async () => {
      await as(aliceToken).create(FIRST).expect(201);
      await as(aliceToken).create(SECOND).expect(201);
      const res = await as(aliceToken).list().expect(200);
      expect((res.body as PurchaseDto[]).map((p) => p.purchasedAt)).toEqual([
        '2026-06-01',
        '2026-01-15',
      ]);
    });

    it('gets one purchase', async () => {
      const { body: created } = await as(aliceToken).create(FIRST).expect(201);
      const res = await as(aliceToken).get(created.id).expect(200);
      expect(res.body).toEqual(created);
    });

    it('updates a purchase', async () => {
      const { body: created } = await as(aliceToken).create(FIRST).expect(201);
      const res = await as(aliceToken)
        .update(created.id, { quantity: '1', unit: 'cay', unitPrice: 12_500_000, note: 'Sửa' })
        .expect(200);
      expect(res.body).toMatchObject({
        quantityChi: '10',
        unitPrice: 12_500_000,
        totalCost: 125_000_000,
        purchasedAt: '2026-01-15',
        note: 'Sửa',
      });
    });

    it('clears the note with null', async () => {
      const { body: created } = await as(aliceToken).create(SECOND).expect(201);
      const res = await as(aliceToken).update(created.id, { note: null }).expect(200);
      expect(res.body.note).toBeNull();
    });

    it('deletes a purchase', async () => {
      const { body: created } = await as(aliceToken).create(FIRST).expect(201);
      await as(aliceToken).remove(created.id).expect(204);
      await as(aliceToken).get(created.id).expect(404);
      await as(aliceToken).remove(created.id).expect(404);
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      await as(aliceToken).get(randomUUID()).expect(404);
      await as(aliceToken).get('not-a-uuid').expect(400);
    });
  });

  describe('validation', () => {
    it('returns 400 with the failing fields', async () => {
      const res = await as(aliceToken)
        .create({ ...FIRST, quantity: '0', unitPrice: 500_000 })
        .expect(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual([
        'quantity',
        'unitPrice',
      ]);
      expect(t.store.rows).toHaveLength(0);
    });

    it('rejects a future purchase date', async () => {
      await as(aliceToken)
        .create({ ...FIRST, purchasedAt: '2099-01-01' })
        .expect(400);
    });

    it('does not let the client choose userId', async () => {
      await as(aliceToken)
        .create({ ...FIRST, userId: BOB })
        .expect(400);
    });

    it('rejects a quantity without its unit on update', async () => {
      const { body: created } = await as(aliceToken).create(FIRST).expect(201);
      await as(aliceToken).update(created.id, { quantity: '2' }).expect(400);
    });
  });

  describe('isolation between users', () => {
    it("Bob cannot see, change or delete Alice's purchases", async () => {
      const { body: alices } = await as(aliceToken).create(FIRST).expect(201);

      const bobList = await as(bobToken).list().expect(200);
      expect(bobList.body).toEqual([]);
      await as(bobToken).get(alices.id).expect(404);
      await as(bobToken).update(alices.id, { unitPrice: 1_000_000 }).expect(404);
      await as(bobToken).remove(alices.id).expect(404);

      const still = await as(aliceToken).get(alices.id).expect(200);
      expect(still.body).toEqual(alices);
    });

    it('each user only lists their own purchases', async () => {
      await as(aliceToken).create(FIRST).expect(201);
      await as(bobToken).create(SECOND).expect(201);
      const alice = await as(aliceToken).list().expect(200);
      const bob = await as(bobToken).list().expect(200);
      expect(alice.body).toHaveLength(1);
      expect(bob.body).toHaveLength(1);
      expect(alice.body[0].purchasedAt).toBe('2026-01-15');
      expect(bob.body[0].purchasedAt).toBe('2026-06-01');
    });
  });
});
