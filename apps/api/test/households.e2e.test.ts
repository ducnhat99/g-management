import { randomUUID } from 'node:crypto';
import type { HouseholdDto, PortfolioSummaryDto, PurchaseDto } from '@gold/shared';
import { ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthAdminError } from '../src/households/auth-admin';
import { createTestApp, emailOf, INVITE_REDIRECT, type TestApp } from './support/test-app';

const PURCHASE = { quantity: '5', unit: 'chi', unitPrice: 12_000_000, purchasedAt: '2026-01-15' };

describe('households (family sharing)', () => {
  let t: TestApp;
  let husband: string;
  let wife: string;
  const wifeEmail = () => emailOf(wife);

  /** Requests as `userId` (token email = emailOf(userId) unless given). */
  const as = (userId: string, email?: string) => {
    const server = t.app.getHttpServer();
    // Wrapped in a plain object: returning the supertest request itself from an async function
    // would run it (it is a thenable) and hand back the response instead.
    const auth = async (r: request.Test) => {
      const token = await t.tokenFor(userId, email ? { email } : {});
      const ready = r.set('Authorization', `Bearer ${token}`);
      return { expect: (status: number) => ready.expect(status) };
    };
    return {
      household: async () => auth(request(server).get('/household')),
      summary: async () => auth(request(server).get('/portfolio/summary')),
      purchases: async () => auth(request(server).get('/purchases')),
      buy: async (body: object = PURCHASE) => auth(request(server).post('/purchases').send(body)),
      editPurchase: async (id: string, body: object) =>
        auth(request(server).patch(`/purchases/${id}`).send(body)),
      deletePurchase: async (id: string) => auth(request(server).delete(`/purchases/${id}`)),
      invite: async (body: object) => auth(request(server).post('/household/invites').send(body)),
      resend: async (id: string) => auth(request(server).post(`/household/invites/${id}/resend`)),
      revoke: async (id: string) => auth(request(server).delete(`/household/invites/${id}`)),
      setRole: async (memberId: string, role: string) =>
        auth(request(server).patch(`/household/members/${memberId}`).send({ role })),
      remove: async (memberId: string) =>
        auth(request(server).delete(`/household/members/${memberId}`)),
    };
  };

  /** Husband invites wife with `role`, and she opens the app once (accepting the invite). */
  async function wifeJoins(role: 'editor' | 'viewer' = 'editor') {
    await (await as(husband).invite({ email: wifeEmail(), role })).expect(201);
    await (await as(wife).summary()).expect(200);
    const { body } = await (await as(husband).household()).expect(200);
    return (body as HouseholdDto).members.find((m) => !m.isYou)!;
  }

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(() => {
    t.reset();
    husband = randomUUID();
    wife = randomUUID();
    // Prices do not matter here: behave like "no price yet", which the summary handles.
    t.prices.getLatest.mockReset().mockRejectedValue(new ServiceUnavailableException('no price'));
  });

  describe('first visit', () => {
    it('gives a new user their own household, as owner', async () => {
      const { body } = await (await as(husband).household()).expect(200);
      expect(body).toMatchObject({
        name: 'Gia đình',
        yourRole: 'owner',
        members: [{ email: emailOf(husband), role: 'owner', isYou: true }],
        invites: [],
      });
    });
  });

  describe('inviting', () => {
    it('emails the invite through Supabase and lists it as pending', async () => {
      const res = await (
        await as(husband).invite({ email: ` ${wifeEmail().toUpperCase()} `, role: 'editor' })
      ).expect(201);
      expect(res.body).toMatchObject({ email: wifeEmail(), role: 'editor', isExpired: false });
      expect(t.authAdmin.inviteUserByEmail).toHaveBeenCalledWith(wifeEmail(), INVITE_REDIRECT);

      const { body } = await (await as(husband).household()).expect(200);
      expect((body as HouseholdDto).invites).toHaveLength(1);
    });

    it('lets the invited person in on the same portfolio with the invited role', async () => {
      await (await as(husband).buy()).expect(201);
      await (await as(husband).invite({ email: wifeEmail(), role: 'editor' })).expect(201);

      const { body } = await (await as(wife).summary()).expect(200);
      const summary = body as PortfolioSummaryDto;
      expect(summary.access).toEqual({ role: 'editor', memberCount: 2 });
      expect(summary.portfolio.lots).toHaveLength(1);
      expect(summary.portfolio.lots[0]?.createdBy).toBe(emailOf(husband));

      const household = (await (await as(husband).household()).expect(200)).body as HouseholdDto;
      expect(household.invites).toEqual([]);
      expect(household.members.map((m) => [m.email, m.role])).toEqual([
        [emailOf(husband), 'owner'],
        [wifeEmail(), 'editor'],
      ]);
    });

    it('shares changes both ways and records who entered each purchase', async () => {
      await wifeJoins('editor');
      const { body: added } = await (
        await as(wife).buy({ ...PURCHASE, quantity: '1' })
      ).expect(201);
      expect((added as PurchaseDto).createdBy).toBe(wifeEmail());

      const { body: list } = await (await as(husband).purchases()).expect(200);
      expect((list as PurchaseDto[]).map((p) => p.createdBy)).toEqual([wifeEmail()]);

      await (await as(husband).deletePurchase(added.id)).expect(204);
      expect((await (await as(wife).purchases()).expect(200)).body).toEqual([]);
    });

    it.each([
      [{ email: 'not-an-email', role: 'editor' }, 400],
      [{ email: 'vo@example.com', role: 'owner' }, 400],
      [{ email: 'vo@example.com' }, 400],
    ])('rejects an invalid invite %j', async (body, status) => {
      await (await as(husband).invite(body)).expect(status);
      expect(t.authAdmin.inviteUserByEmail).not.toHaveBeenCalled();
    });

    it('refuses to invite yourself, a member, or an email with a pending invite', async () => {
      await (await as(husband).invite({ email: emailOf(husband), role: 'editor' })).expect(400);
      await wifeJoins();
      const member = await (
        await as(husband).invite({ email: wifeEmail(), role: 'viewer' })
      ).expect(409);
      expect(member.body.message).toMatch(/đã là thành viên/);

      const other = 'em-trai@example.com';
      await (await as(husband).invite({ email: other, role: 'viewer' })).expect(201);
      const again = await (await as(husband).invite({ email: other, role: 'viewer' })).expect(409);
      expect(again.body.message).toMatch(/Gửi lại/);
    });

    it('refuses an email that already has its own G-management household', async () => {
      await (await as(wife).household()).expect(200); // wife already uses the app on her own
      const res = await (
        await as(husband).invite({ email: wifeEmail(), role: 'editor' })
      ).expect(409);
      expect(res.body.message).toMatch(/tài khoản G-management riêng/);
    });

    it('reports when Supabase says the email is already registered', async () => {
      t.authAdmin.inviteUserByEmail.mockRejectedValueOnce(
        new AuthAdminError(
          'already_registered',
          'A user with this email address has already been registered',
        ),
      );
      const res = await (
        await as(husband).invite({ email: wifeEmail(), role: 'editor' })
      ).expect(409);
      expect(res.body.message).toMatch(/đã có tài khoản/);
      expect(t.households.invites).toHaveLength(0);
    });

    it('resends an invite with a fresh 24 h window', async () => {
      const { body: invite } = await (
        await as(husband).invite({ email: wifeEmail(), role: 'editor' })
      ).expect(201);
      const { body: resent } = await (await as(husband).resend(invite.id)).expect(200);
      expect(t.authAdmin.inviteUserByEmail).toHaveBeenCalledTimes(2);
      expect(Date.parse(resent.expiresAt)).toBeGreaterThanOrEqual(Date.parse(invite.expiresAt));
    });

    it('resend recovers a half-used invite by replacing its never-used login', async () => {
      const { body: invite } = await (
        await as(husband).invite({ email: wifeEmail(), role: 'editor' })
      ).expect(201);
      const staleLogin = t.households.invites[0]?.authUserId;
      t.authAdmin.inviteUserByEmail.mockRejectedValueOnce(
        new AuthAdminError(
          'already_registered',
          'A user with this email address has already been registered',
        ),
      );

      await (await as(husband).resend(invite.id)).expect(200);
      expect(t.authAdmin.deleteUser).toHaveBeenCalledWith(staleLogin);
      expect(t.authAdmin.inviteUserByEmail).toHaveBeenCalledTimes(3);
      expect(t.households.invites[0]?.authUserId).not.toBe(staleLogin);
    });

    it('resend does not delete a login that already belongs to a member', async () => {
      const { body: invite } = await (
        await as(husband).invite({ email: wifeEmail(), role: 'editor' })
      ).expect(201);
      // That login somehow became a member of a household already: never delete it.
      const login = t.households.invites[0]!.authUserId!;
      await t.households.createHouseholdWithOwner(login, 'someone@else.dev');
      t.authAdmin.inviteUserByEmail.mockRejectedValueOnce(
        new AuthAdminError('already_registered', 'already been registered'),
      );

      await (await as(husband).resend(invite.id)).expect(409);
      expect(t.authAdmin.deleteUser).not.toHaveBeenCalled();
    });

    it('cancels an invite: deletes the unused login and the person no longer joins', async () => {
      const { body: invite } = await (
        await as(husband).invite({ email: wifeEmail(), role: 'editor' })
      ).expect(201);
      const authUserId = t.households.invites[0]?.authUserId;
      await (await as(husband).revoke(invite.id)).expect(204);
      expect(t.authAdmin.deleteUser).toHaveBeenCalledWith(authUserId);

      await (await as(husband).buy()).expect(201);
      const { body } = await (await as(wife).summary()).expect(200);
      expect((body as PortfolioSummaryDto).access).toEqual({ role: 'owner', memberCount: 1 });
      expect((body as PortfolioSummaryDto).portfolio.lots).toEqual([]);
      await (await as(husband).revoke(invite.id)).expect(404);
    });
  });

  describe('roles', () => {
    it('a viewer sees everything but cannot change purchases', async () => {
      await (await as(husband).buy()).expect(201);
      await wifeJoins('viewer');
      const { body: list } = await (await as(wife).purchases()).expect(200);
      expect(list).toHaveLength(1);

      const created = await (await as(wife).buy()).expect(403);
      expect(created.body.message).toMatch(/chỉ có quyền xem/);
      await (await as(wife).editPurchase(list[0].id, { unitPrice: 1_000_000 })).expect(403);
      await (await as(wife).deletePurchase(list[0].id)).expect(403);
      expect(t.store.rows).toHaveLength(1);
    });

    it('the owner can switch a member between editor and viewer', async () => {
      const member = await wifeJoins('editor');
      await (await as(wife).buy()).expect(201);

      const { body } = await (await as(husband).setRole(member.id, 'viewer')).expect(200);
      expect(body).toMatchObject({ email: wifeEmail(), role: 'viewer' });
      await (await as(wife).buy()).expect(403);

      await (await as(husband).setRole(member.id, 'editor')).expect(200);
      await (await as(wife).buy()).expect(201);
    });

    it('only the owner manages members, and the owner cannot be changed', async () => {
      const member = await wifeJoins('editor');
      const ownerId = t.households.members.find((m) => m.role === 'owner')!.id;

      await (await as(wife).invite({ email: 'x@example.com', role: 'viewer' })).expect(403);
      await (await as(wife).setRole(ownerId, 'viewer')).expect(403);
      await (await as(wife).remove(member.id)).expect(403);
      const { body } = await (await as(wife).household()).expect(200);
      expect((body as HouseholdDto).invites).toEqual([]); // invites are owner-only information

      await (await as(husband).setRole(ownerId, 'viewer')).expect(400);
      await (await as(husband).remove(ownerId)).expect(400);
      await (await as(husband).setRole(member.id, 'owner')).expect(400);
    });

    it('removing a member deletes their login and their access', async () => {
      const member = await wifeJoins('editor');
      await (await as(wife).buy()).expect(201);

      await (await as(husband).remove(member.id)).expect(204);
      expect(t.authAdmin.deleteUser).toHaveBeenCalledWith(wife);

      // Purchases she entered stay; "Thêm bởi" shows nobody since she left.
      const { body } = await (await as(husband).purchases()).expect(200);
      expect((body as PurchaseDto[]).map((p) => p.createdBy)).toEqual([null]);
      // Were her old token still accepted, it would no longer reach the family's data.
      expect((await (await as(wife).purchases()).expect(200)).body).toEqual([]);
    });
  });

  describe('isolation', () => {
    it("another family cannot see or touch this household's invites or members", async () => {
      const member = await wifeJoins('editor');
      const stranger = randomUUID();
      const { body: invite } = await (
        await as(husband).invite({ email: 'b@example.com', role: 'viewer' })
      ).expect(201);

      await (await as(stranger).revoke(invite.id)).expect(404);
      await (await as(stranger).setRole(member.id, 'viewer')).expect(404);
      await (await as(stranger).remove(member.id)).expect(404);
      expect((await (await as(stranger).purchases()).expect(200)).body).toEqual([]);
    });
  });
});
