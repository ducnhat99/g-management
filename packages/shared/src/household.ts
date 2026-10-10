import { z } from 'zod';

/** owner: everything, incl. managing members. editor: add/edit/delete purchases. viewer: read only. */
export const MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Roles an owner can give to someone else (there is exactly one owner). */
export const ASSIGNABLE_ROLES = ['editor', 'viewer'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Chủ sở hữu',
  editor: 'Có thể chỉnh sửa',
  viewer: 'Chỉ xem',
};

const RANK: Record<MemberRole, number> = { viewer: 0, editor: 1, owner: 2 };

/** True when `role` is at least `required` (owner > editor > viewer). */
export function hasRole(role: MemberRole, required: MemberRole): boolean {
  return RANK[role] >= RANK[required];
}

export const canEditPurchases = (role: MemberRole) => hasRole(role, 'editor');
export const canManageMembers = (role: MemberRole) => role === 'owner';

export const inviteMemberSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email('Email không hợp lệ').max(320, 'Email quá dài')),
    role: z.enum(ASSIGNABLE_ROLES, 'Chọn quyền cho thành viên'),
  })
  .strict();

export const changeRoleSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) }).strict();

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export interface HouseholdMemberDto {
  id: string;
  userId: string;
  email: string;
  role: MemberRole;
  /** True for the signed-in user. */
  isYou: boolean;
  joinedAt: string;
}

export interface HouseholdInviteDto {
  id: string;
  email: string;
  role: AssignableRole;
  invitedAt: string;
  expiresAt: string;
  /** The email link has expired; resend to get a new one. */
  isExpired: boolean;
}

/** GET /household */
export interface HouseholdDto {
  id: string;
  name: string;
  /** The signed-in user's role. */
  yourRole: MemberRole;
  members: HouseholdMemberDto[];
  /** Pending invites (only filled in for the owner). */
  invites: HouseholdInviteDto[];
}
