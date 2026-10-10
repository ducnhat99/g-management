import type {
  AssignableRole,
  HouseholdDto,
  HouseholdInviteDto,
  HouseholdMemberDto,
  InviteMemberInput,
  MemberRole,
} from '@gold/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HouseholdInvite, HouseholdMember } from '@prisma/client';
import type { AuthUser } from '../auth/token-verifier';
import { Clock } from '../common/clock';
import { AuthAdmin, AuthAdminError } from './auth-admin';
import { HouseholdConfig } from './household.config';
import { HouseholdStore } from './household.store';

/** Who is calling, resolved once per request by HouseholdGuard. */
export interface MemberContext {
  memberId: string;
  userId: string;
  email: string;
  householdId: string;
  role: MemberRole;
}

/** Supabase's invite links are valid for 24 hours by default. */
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

const toContext = (member: HouseholdMember): MemberContext => ({
  memberId: member.id,
  userId: member.userId,
  email: member.email,
  householdId: member.householdId,
  role: member.role,
});

@Injectable()
export class HouseholdService {
  private readonly logger = new Logger(HouseholdService.name);

  constructor(
    private readonly store: HouseholdStore,
    private readonly authAdmin: AuthAdmin,
    private readonly clock: Clock,
    private readonly config: HouseholdConfig,
  ) {}

  /**
   * The caller's household membership. A user with none joins the household that invited their
   * email (first visit after accepting an invite), or else gets a new household of their own.
   */
  async resolve(user: AuthUser): Promise<MemberContext> {
    const existing = await this.store.findMemberByUser(user.id);
    if (existing) {
      // Keep the stored email in step with Supabase (used in member lists).
      if (user.email && existing.email !== user.email) {
        return toContext(await this.store.updateMember(existing.id, { email: user.email }));
      }
      return toContext(existing);
    }

    const invite = user.email ? await this.store.findPendingInviteByEmail(user.email) : null;
    if (invite && user.email) {
      const member = await this.store.acceptInvite(invite, user.id, user.email, this.clock.now());
      this.logger.log(`${user.email} joined household ${invite.householdId} as ${invite.role}`);
      return toContext(member);
    }

    return toContext(await this.store.createHouseholdWithOwner(user.id, user.email ?? ''));
  }

  async memberCount(householdId: string): Promise<number> {
    return (await this.store.listMembers(householdId)).length;
  }

  /** userId -> email for everyone in the household (for "Thêm bởi …"). */
  async memberEmails(householdId: string): Promise<Map<string, string>> {
    const members = await this.store.listMembers(householdId);
    return new Map(members.map((m) => [m.userId, m.email]));
  }

  async get(ctx: MemberContext): Promise<HouseholdDto> {
    const [household, members, invites] = await Promise.all([
      this.store.getHousehold(ctx.householdId),
      this.store.listMembers(ctx.householdId),
      ctx.role === 'owner'
        ? this.store.listInvites(ctx.householdId, 'pending')
        : Promise.resolve([] as HouseholdInvite[]),
    ]);
    return {
      id: household.id,
      name: household.name,
      yourRole: ctx.role,
      members: members.map((m) => this.toMemberDto(m, ctx)),
      invites: invites.map((i) => this.toInviteDto(i)),
    };
  }

  /** Owner only (HouseholdGuard). Sends Supabase's invite email, then records the invite. */
  async invite(ctx: MemberContext, input: InviteMemberInput): Promise<HouseholdInviteDto> {
    const { email, role } = input;
    if (email === ctx.email) {
      throw new BadRequestException('Bạn không thể tự mời chính mình.');
    }
    const member = await this.store.findMemberByEmail(email);
    if (member) {
      throw new ConflictException(
        member.householdId === ctx.householdId
          ? 'Người này đã là thành viên của gia đình.'
          : 'Email này đã có tài khoản G-management riêng.',
      );
    }
    const pending = await this.store.findPendingInviteByEmail(email);
    if (pending) {
      throw new ConflictException(
        pending.householdId === ctx.householdId
          ? 'Đã có lời mời đang chờ cho email này. Dùng “Gửi lại” nếu cần.'
          : 'Email này đang có lời mời từ một gia đình khác.',
      );
    }

    const { userId } = await this.sendInviteEmail(email);
    const invite = await this.store.createInvite({
      householdId: ctx.householdId,
      email,
      role,
      authUserId: userId,
      invitedBy: ctx.userId,
      expiresAt: new Date(this.clock.now().getTime() + INVITE_TTL_MS),
    });
    return this.toInviteDto(invite);
  }

  /**
   * Owner only. Sends a fresh invite email and restarts the 24 h window. If an earlier link was
   * half-used (Supabase confirmed the login but the person never reached the app), Supabase refuses
   * to re-invite an "already registered" email: delete that never-used login and invite again.
   */
  async resendInvite(ctx: MemberContext, inviteId: string): Promise<HouseholdInviteDto> {
    const invite = await this.pendingInvite(ctx, inviteId);
    const { userId } = await this.sendInviteEmail(invite.email).catch(async (error: unknown) => {
      const stale =
        error instanceof ConflictException &&
        invite.authUserId &&
        !(await this.store.findMemberByUser(invite.authUserId));
      if (!stale || !invite.authUserId) throw error;
      this.logger.log(
        `Re-inviting ${invite.email}: removing never-used login ${invite.authUserId}`,
      );
      await this.authAdmin.deleteUser(invite.authUserId);
      return this.sendInviteEmail(invite.email);
    });
    const updated = await this.store.updateInvite(invite.id, {
      authUserId: userId,
      expiresAt: new Date(this.clock.now().getTime() + INVITE_TTL_MS),
    });
    return this.toInviteDto(updated);
  }

  /** Owner only. Cancels the invite and deletes the not-yet-used auth account Supabase created. */
  async revokeInvite(ctx: MemberContext, inviteId: string): Promise<void> {
    const invite = await this.pendingInvite(ctx, inviteId);
    await this.store.updateInvite(invite.id, { status: 'revoked' });
    if (invite.authUserId && !(await this.store.findMemberByUser(invite.authUserId))) {
      await this.authAdmin.deleteUser(invite.authUserId).catch((error: unknown) => {
        this.logger.warn(`Could not delete invited user ${invite.authUserId}: ${String(error)}`);
      });
    }
  }

  /** Owner only. The owner's own role never changes. */
  async changeRole(
    ctx: MemberContext,
    memberId: string,
    role: AssignableRole,
  ): Promise<HouseholdMemberDto> {
    const member = await this.otherMember(ctx, memberId);
    return this.toMemberDto(await this.store.updateMember(member.id, { role }), ctx);
  }

  /**
   * Owner only. Removes the member and deletes their login, so they can no longer sign in.
   * Purchases they entered stay in the household.
   */
  async removeMember(ctx: MemberContext, memberId: string): Promise<void> {
    const member = await this.otherMember(ctx, memberId);
    await this.store.deleteMember(member.id);
    await this.authAdmin.deleteUser(member.userId).catch((error: unknown) => {
      this.logger.warn(
        `Removed member ${member.email} but could not delete login: ${String(error)}`,
      );
    });
  }

  private async sendInviteEmail(email: string): Promise<{ userId: string }> {
    try {
      return await this.authAdmin.inviteUserByEmail(email, this.config.inviteRedirectUrl);
    } catch (error) {
      if (error instanceof AuthAdminError && error.code === 'already_registered') {
        throw new ConflictException('Email này đã có tài khoản G-management.');
      }
      if (error instanceof AuthAdminError) {
        throw new ServiceUnavailableException(`Không gửi được email mời: ${error.message}`);
      }
      throw error;
    }
  }

  private async pendingInvite(ctx: MemberContext, inviteId: string): Promise<HouseholdInvite> {
    const invite = await this.store.findInvite(ctx.householdId, inviteId);
    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Không tìm thấy lời mời đang chờ.');
    }
    return invite;
  }

  private async otherMember(ctx: MemberContext, memberId: string): Promise<HouseholdMember> {
    const member = await this.store.findMember(ctx.householdId, memberId);
    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên.');
    }
    if (member.role === 'owner') {
      throw new BadRequestException('Không thể thay đổi chủ sở hữu.');
    }
    return member;
  }

  private toMemberDto(member: HouseholdMember, ctx: MemberContext): HouseholdMemberDto {
    return {
      id: member.id,
      userId: member.userId,
      email: member.email,
      role: member.role,
      isYou: member.userId === ctx.userId,
      joinedAt: member.createdAt.toISOString(),
    };
  }

  private toInviteDto(invite: HouseholdInvite): HouseholdInviteDto {
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role as AssignableRole,
      invitedAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      isExpired: invite.expiresAt.getTime() <= this.clock.now().getTime(),
    };
  }
}
