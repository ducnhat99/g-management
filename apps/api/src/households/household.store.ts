import { Injectable } from '@nestjs/common';
import type {
  Household,
  HouseholdInvite,
  HouseholdMember,
  InviteStatus,
  MemberRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NewInvite {
  householdId: string;
  email: string;
  role: MemberRole;
  authUserId: string | null;
  invitedBy: string;
  expiresAt: Date;
}

/** Households, their members and invites. Abstract so e2e tests can run without a database. */
export abstract class HouseholdStore {
  abstract findMemberByUser(userId: string): Promise<HouseholdMember | null>;
  abstract findMemberByEmail(email: string): Promise<HouseholdMember | null>;
  abstract findMember(householdId: string, memberId: string): Promise<HouseholdMember | null>;
  abstract listMembers(householdId: string): Promise<HouseholdMember[]>;
  abstract updateMember(
    memberId: string,
    data: Partial<Pick<HouseholdMember, 'email' | 'role'>>,
  ): Promise<HouseholdMember>;
  abstract deleteMember(memberId: string): Promise<void>;
  /** A new household with `userId` as its owner. */
  abstract createHouseholdWithOwner(userId: string, email: string): Promise<HouseholdMember>;
  abstract getHousehold(householdId: string): Promise<Household>;

  abstract findPendingInviteByEmail(email: string): Promise<HouseholdInvite | null>;
  abstract findInvite(householdId: string, inviteId: string): Promise<HouseholdInvite | null>;
  abstract listInvites(householdId: string, status: InviteStatus): Promise<HouseholdInvite[]>;
  abstract createInvite(invite: NewInvite): Promise<HouseholdInvite>;
  abstract updateInvite(
    inviteId: string,
    data: Partial<Pick<HouseholdInvite, 'status' | 'expiresAt' | 'authUserId' | 'acceptedAt'>>,
  ): Promise<HouseholdInvite>;
  /** In one transaction: add the user as a member with the invite's role, mark it accepted. */
  abstract acceptInvite(
    invite: HouseholdInvite,
    userId: string,
    email: string,
    now: Date,
  ): Promise<HouseholdMember>;
}

@Injectable()
export class PrismaHouseholdStore extends HouseholdStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findMemberByUser(userId: string) {
    return this.prisma.householdMember.findUnique({ where: { userId } });
  }

  findMemberByEmail(email: string) {
    return this.prisma.householdMember.findFirst({ where: { email } });
  }

  findMember(householdId: string, memberId: string) {
    return this.prisma.householdMember.findFirst({ where: { id: memberId, householdId } });
  }

  listMembers(householdId: string) {
    return this.prisma.householdMember.findMany({
      where: { householdId },
      orderBy: { createdAt: 'asc' },
    });
  }

  updateMember(memberId: string, data: Partial<Pick<HouseholdMember, 'email' | 'role'>>) {
    return this.prisma.householdMember.update({ where: { id: memberId }, data });
  }

  async deleteMember(memberId: string) {
    await this.prisma.householdMember.delete({ where: { id: memberId } });
  }

  async createHouseholdWithOwner(userId: string, email: string) {
    const household = await this.prisma.household.create({
      data: { members: { create: { userId, email, role: 'owner' } } },
      include: { members: true },
    });
    return household.members[0] as HouseholdMember;
  }

  getHousehold(householdId: string) {
    return this.prisma.household.findUniqueOrThrow({ where: { id: householdId } });
  }

  findPendingInviteByEmail(email: string) {
    return this.prisma.householdInvite.findFirst({
      where: { email, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  findInvite(householdId: string, inviteId: string) {
    return this.prisma.householdInvite.findFirst({ where: { id: inviteId, householdId } });
  }

  listInvites(householdId: string, status: InviteStatus) {
    return this.prisma.householdInvite.findMany({
      where: { householdId, status },
      orderBy: { createdAt: 'desc' },
    });
  }

  createInvite(invite: NewInvite) {
    return this.prisma.householdInvite.create({ data: invite });
  }

  updateInvite(
    inviteId: string,
    data: Partial<Pick<HouseholdInvite, 'status' | 'expiresAt' | 'authUserId' | 'acceptedAt'>>,
  ) {
    return this.prisma.householdInvite.update({ where: { id: inviteId }, data });
  }

  acceptInvite(invite: HouseholdInvite, userId: string, email: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.householdMember.create({
        data: { householdId: invite.householdId, userId, email, role: invite.role },
      });
      await tx.householdInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: now },
      });
      return member;
    });
  }
}
