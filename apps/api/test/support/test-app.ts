import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Prisma,
  type Household,
  type HouseholdInvite,
  type HouseholdMember,
  type InviteStatus,
  type Purchase,
} from '@prisma/client';
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type CryptoKey,
  type JWTPayload,
} from 'jose';
import { vi, type Mock } from 'vitest';
import { AppModule } from '../../src/app.module';
import { SupabaseTokenVerifier, TokenVerifier } from '../../src/auth/token-verifier';
import { AuthAdmin } from '../../src/households/auth-admin';
import { HouseholdConfig } from '../../src/households/household.config';
import { HouseholdStore, type NewInvite } from '../../src/households/household.store';
import { PricesService } from '../../src/prices/prices.service';
import { PurchaseStore, type PurchaseWrite } from '../../src/purchases/purchase.store';

export const ISSUER = 'https://test-project.supabase.co/auth/v1';
export const INVITE_REDIRECT = 'https://web.test/auth/confirm';
const KID = 'test-key';

let clock = Date.parse('2026-10-09T03:00:00Z');
const tick = () => new Date((clock += 1000));

/** In-memory PurchaseStore with the same household scoping as the Prisma one. */
export class FakePurchaseStore extends PurchaseStore {
  rows: Purchase[] = [];

  async list(householdId: string) {
    return this.rows
      .filter((r) => r.householdId === householdId)
      .sort(
        (a, b) =>
          b.purchasedAt.getTime() - a.purchasedAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
  }

  async find(householdId: string, id: string) {
    return this.rows.find((r) => r.householdId === householdId && r.id === id) ?? null;
  }

  async create(householdId: string, userId: string, data: PurchaseWrite) {
    const now = tick();
    const row: Purchase = {
      id: randomUUID(),
      householdId,
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

  async update(householdId: string, id: string, data: Partial<PurchaseWrite>) {
    const row = await this.find(householdId, id);
    if (!row) return null;
    if (data.quantityChi !== undefined) row.quantityChi = new Prisma.Decimal(data.quantityChi);
    if (data.unitPrice !== undefined) row.unitPrice = BigInt(data.unitPrice);
    if (data.purchasedAt !== undefined) row.purchasedAt = new Date(`${data.purchasedAt}T00:00:00Z`);
    if (data.note !== undefined) row.note = data.note;
    row.updatedAt = tick();
    return row;
  }

  async delete(householdId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.householdId === householdId && r.id === id));
    return this.rows.length < before;
  }
}

/** In-memory HouseholdStore. */
export class FakeHouseholdStore extends HouseholdStore {
  households: Household[] = [];
  members: HouseholdMember[] = [];
  invites: HouseholdInvite[] = [];

  async findMemberByUser(userId: string) {
    return this.members.find((m) => m.userId === userId) ?? null;
  }
  async findMemberByEmail(email: string) {
    return this.members.find((m) => m.email === email) ?? null;
  }
  async findMember(householdId: string, memberId: string) {
    return this.members.find((m) => m.householdId === householdId && m.id === memberId) ?? null;
  }
  async listMembers(householdId: string) {
    return this.members.filter((m) => m.householdId === householdId);
  }
  async updateMember(memberId: string, data: Partial<Pick<HouseholdMember, 'email' | 'role'>>) {
    const member = this.members.find((m) => m.id === memberId);
    if (!member) throw new Error(`member ${memberId} not found`);
    Object.assign(member, data, { updatedAt: tick() });
    return member;
  }
  async deleteMember(memberId: string) {
    this.members = this.members.filter((m) => m.id !== memberId);
  }
  async createHouseholdWithOwner(userId: string, email: string) {
    const now = tick();
    const household: Household = {
      id: randomUUID(),
      name: 'Gia đình',
      createdAt: now,
      updatedAt: now,
    };
    this.households.push(household);
    return this.addMember(household.id, userId, email, 'owner');
  }
  async getHousehold(householdId: string) {
    const household = this.households.find((h) => h.id === householdId);
    if (!household) throw new Error(`household ${householdId} not found`);
    return household;
  }
  async findPendingInviteByEmail(email: string) {
    return this.invites.find((i) => i.email === email && i.status === 'pending') ?? null;
  }
  async findInvite(householdId: string, inviteId: string) {
    return this.invites.find((i) => i.householdId === householdId && i.id === inviteId) ?? null;
  }
  async listInvites(householdId: string, status: InviteStatus) {
    return this.invites.filter((i) => i.householdId === householdId && i.status === status);
  }
  async createInvite(invite: NewInvite) {
    const now = tick();
    const row: HouseholdInvite = {
      id: randomUUID(),
      status: 'pending',
      acceptedAt: null,
      createdAt: now,
      updatedAt: now,
      ...invite,
    };
    this.invites.push(row);
    return row;
  }
  async updateInvite(
    inviteId: string,
    data: Partial<Pick<HouseholdInvite, 'status' | 'expiresAt' | 'authUserId' | 'acceptedAt'>>,
  ) {
    const invite = this.invites.find((i) => i.id === inviteId);
    if (!invite) throw new Error(`invite ${inviteId} not found`);
    Object.assign(invite, data, { updatedAt: tick() });
    return invite;
  }
  async acceptInvite(invite: HouseholdInvite, userId: string, email: string, now: Date) {
    await this.updateInvite(invite.id, { status: 'accepted', acceptedAt: now });
    return this.addMember(invite.householdId, userId, email, invite.role);
  }

  private addMember(
    householdId: string,
    userId: string,
    email: string,
    role: HouseholdMember['role'],
  ) {
    const now = tick();
    const member: HouseholdMember = {
      id: randomUUID(),
      householdId,
      userId,
      email,
      role,
      createdAt: now,
      updatedAt: now,
    };
    this.members.push(member);
    return member;
  }
}

/** Records invites instead of emailing; each invite "creates" an auth user with a new id. */
export class FakeAuthAdmin extends AuthAdmin {
  inviteUserByEmail = vi.fn(async (_email: string, _redirectTo: string) => ({
    userId: randomUUID(),
  }));
  deleteUser = vi.fn(async (_userId: string) => {});
}

export interface TestApp {
  app: INestApplication;
  store: FakePurchaseStore;
  households: FakeHouseholdStore;
  authAdmin: FakeAuthAdmin;
  /**
   * A valid Supabase-shaped access token for `userId`; `claims` override any default. The email
   * claim defaults to `<userId>@test.dev`.
   */
  tokenFor(userId: string, claims?: JWTPayload & { exp?: number; email?: string }): Promise<string>;
  /** A token signed by a key the API does not trust. */
  foreignToken(userId: string): Promise<string>;
  /** Stubbed PricesService; set what getLatest resolves or rejects with per test. */
  prices: {
    getLatest: Mock<PricesService['getLatest']>;
    refresh: Mock<PricesService['refresh']>;
    getHistory: Mock<PricesService['getHistory']>;
  };
  /** Empties every fake store. */
  reset(): void;
}

export const emailOf = (userId: string) => `${userId}@test.dev`;

async function sign(key: CryptoKey, userId: string, claims: JWTPayload = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    role: 'authenticated',
    sub: userId,
    email: emailOf(userId),
    iss: ISSUER,
    aud: 'authenticated',
    iat: now,
    exp: now + 3600,
    ...claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: KID })
    .sign(key);
}

/**
 * The real AppModule, with a local signing key, in-memory purchase and household stores, a fake
 * Supabase admin (no emails sent) and a stubbed PricesService (covered by prices.service.test.ts).
 */
export async function createTestApp(): Promise<TestApp> {
  const trusted = await generateKeyPair('ES256');
  const untrusted = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(trusted.publicKey)), kid: KID, alg: 'ES256' };
  const verifier = new SupabaseTokenVerifier(createLocalJWKSet({ keys: [jwk] }), ISSUER, ['ES256']);
  const store = new FakePurchaseStore();
  const households = new FakeHouseholdStore();
  const authAdmin = new FakeAuthAdmin();
  const prices = {
    getLatest: vi.fn<PricesService['getLatest']>(),
    refresh: vi.fn<PricesService['refresh']>(),
    getHistory: vi.fn<PricesService['getHistory']>(),
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenVerifier)
    .useValue(verifier)
    .overrideProvider(PurchaseStore)
    .useValue(store)
    .overrideProvider(HouseholdStore)
    .useValue(households)
    .overrideProvider(AuthAdmin)
    .useValue(authAdmin)
    .overrideProvider(HouseholdConfig)
    .useValue(new HouseholdConfig(INVITE_REDIRECT))
    .overrideProvider(PricesService)
    .useValue(prices)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    store,
    households,
    authAdmin,
    prices,
    tokenFor: (userId, claims) => sign(trusted.privateKey, userId, claims),
    foreignToken: (userId) => sign(untrusted.privateKey, userId),
    reset() {
      store.rows = [];
      households.households = [];
      households.members = [];
      households.invites = [];
      authAdmin.inviteUserByEmail.mockClear();
      authAdmin.deleteUser.mockClear();
    },
  };
}
