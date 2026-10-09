import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, type Purchase } from '@prisma/client';
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type CryptoKey,
  type JWTPayload,
} from 'jose';
import { AppModule } from '../../src/app.module';
import { SupabaseTokenVerifier, TokenVerifier } from '../../src/auth/token-verifier';
import { PurchaseStore, type PurchaseWrite } from '../../src/purchases/purchase.store';

export const ISSUER = 'https://test-project.supabase.co/auth/v1';
const KID = 'test-key';

/** In-memory PurchaseStore with the same user scoping as the Prisma one. */
export class FakePurchaseStore extends PurchaseStore {
  rows: Purchase[] = [];
  private clock = Date.parse('2026-10-09T03:00:00Z');

  async list(userId: string) {
    return this.rows
      .filter((r) => r.userId === userId)
      .sort(
        (a, b) =>
          b.purchasedAt.getTime() - a.purchasedAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
  }

  async find(userId: string, id: string) {
    return this.rows.find((r) => r.userId === userId && r.id === id) ?? null;
  }

  async create(userId: string, data: PurchaseWrite) {
    const now = this.tick();
    const row: Purchase = {
      id: randomUUID(),
      userId,
      goldTypeId: 'gold-type-1',
      quantityChi: new Prisma.Decimal(data.quantityChi),
      unitPrice: BigInt(data.unitPrice),
      purchasedAt: new Date(`${data.purchasedAt}T00:00:00Z`),
      note: data.note,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  async update(userId: string, id: string, data: Partial<PurchaseWrite>) {
    const row = await this.find(userId, id);
    if (!row) return null;
    if (data.quantityChi !== undefined) row.quantityChi = new Prisma.Decimal(data.quantityChi);
    if (data.unitPrice !== undefined) row.unitPrice = BigInt(data.unitPrice);
    if (data.purchasedAt !== undefined) row.purchasedAt = new Date(`${data.purchasedAt}T00:00:00Z`);
    if (data.note !== undefined) row.note = data.note;
    row.updatedAt = this.tick();
    return row;
  }

  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    return this.rows.length < before;
  }

  private tick() {
    this.clock += 1000;
    return new Date(this.clock);
  }
}

export interface TestApp {
  app: INestApplication;
  store: FakePurchaseStore;
  /** A valid Supabase-shaped access token for `userId`; `claims` override any default. */
  tokenFor(userId: string, claims?: JWTPayload & { exp?: number }): Promise<string>;
  /** A token signed by a key the API does not trust. */
  foreignToken(userId: string): Promise<string>;
}

async function sign(key: CryptoKey, userId: string, claims: JWTPayload = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    role: 'authenticated',
    sub: userId,
    iss: ISSUER,
    aud: 'authenticated',
    iat: now,
    exp: now + 3600,
    ...claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: KID })
    .sign(key);
}

/** The real AppModule, with a local signing key and an in-memory purchase store. */
export async function createTestApp(): Promise<TestApp> {
  const trusted = await generateKeyPair('ES256');
  const untrusted = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(trusted.publicKey)), kid: KID, alg: 'ES256' };
  const verifier = new SupabaseTokenVerifier(createLocalJWKSet({ keys: [jwk] }), ISSUER, ['ES256']);
  const store = new FakePurchaseStore();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenVerifier)
    .useValue(verifier)
    .overrideProvider(PurchaseStore)
    .useValue(store)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    store,
    tokenFor: (userId, claims) => sign(trusted.privateKey, userId, claims),
    foreignToken: (userId) => sign(untrusted.privateKey, userId),
  };
}
