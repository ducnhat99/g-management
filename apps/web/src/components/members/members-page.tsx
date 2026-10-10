'use client';

import {
  canManageMembers,
  ROLE_LABELS,
  type AssignableRole,
  type HouseholdInviteDto,
  type HouseholdMemberDto,
  type MemberRole,
} from '@gold/shared';
import { useState, type ReactNode } from 'react';
import { AlertIcon, MailIcon, TrashIcon, UsersIcon } from '@/components/icons';
import { Modal } from '@/components/modal';
import { formatDateTimeVN } from '@/lib/format';
import {
  useChangeMemberRole,
  useHousehold,
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
} from '@/lib/queries';
import { InviteForm } from './invite-form';

const ROLE_BADGE: Record<MemberRole, string> = {
  owner: 'bg-amber-100 text-amber-800',
  editor: 'bg-emerald-50 text-emerald-700',
  viewer: 'bg-stone-100 text-stone-600',
};

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-semibold text-stone-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Avatar({ email }: { email: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-amber-600 font-semibold text-white uppercase"
    >
      {email.charAt(0) || '?'}
    </span>
  );
}

function ErrorText({ error }: { error: Error | null }) {
  return error ? <p className="mt-1 text-xs text-red-600">Lỗi: {error.message}</p> : null;
}

function MemberRow({
  member,
  manage,
  onRemove,
}: {
  member: HouseholdMemberDto;
  manage: boolean;
  onRemove: (member: HouseholdMemberDto) => void;
}) {
  const changeRole = useChangeMemberRole();
  const editable = manage && member.role !== 'owner';
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar email={member.email} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-stone-900">
          {member.email || 'Chưa có email'}
          {member.isYou && <span className="ml-2 text-xs font-normal text-stone-500">(Bạn)</span>}
        </p>
        <p className="text-xs text-stone-500">Tham gia {formatDateTimeVN(member.joinedAt)}</p>
        <ErrorText error={changeRole.error} />
      </div>
      {editable ? (
        <div className="flex items-center gap-1">
          <select
            aria-label={`Quyền của ${member.email}`}
            value={member.role}
            disabled={changeRole.isPending}
            onChange={(e) =>
              changeRole.mutate({ memberId: member.id, role: e.target.value as AssignableRole })
            }
            className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:outline-none"
          >
            <option value="editor">{ROLE_LABELS.editor}</option>
            <option value="viewer">{ROLE_LABELS.viewer}</option>
          </select>
          <button
            type="button"
            onClick={() => onRemove(member)}
            aria-label={`Xóa ${member.email} khỏi gia đình`}
            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      ) : (
        <RoleBadge role={member.role} />
      )}
    </li>
  );
}

function InviteRow({ invite }: { invite: HouseholdInviteDto }) {
  const resend = useResendInvite();
  const revoke = useRevokeInvite();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500"
      >
        <MailIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-stone-900">{invite.email}</p>
        <p className="text-xs text-stone-500">
          {ROLE_LABELS[invite.role]} ·{' '}
          {invite.isExpired ? (
            <span className="font-medium text-red-600">Liên kết đã hết hạn</span>
          ) : (
            <>Hết hạn lúc {formatDateTimeVN(invite.expiresAt)}</>
          )}
        </p>
        <ErrorText error={resend.error ?? revoke.error} />
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => resend.mutate(invite.id)}
          disabled={resend.isPending}
          aria-label={`Gửi lại lời mời cho ${invite.email}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
        >
          {resend.isPending ? 'Đang gửi…' : resend.isSuccess ? 'Đã gửi lại' : 'Gửi lại'}
        </button>
        <button
          type="button"
          onClick={() => revoke.mutate(invite.id)}
          disabled={revoke.isPending}
          aria-label={`Hủy lời mời cho ${invite.email}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          Hủy lời mời
        </button>
      </div>
    </li>
  );
}

function RemoveMemberDialog({
  member,
  onClose,
}: {
  member: HouseholdMemberDto;
  onClose: () => void;
}) {
  const remove = useRemoveMember();
  async function confirm() {
    try {
      await remove.mutateAsync(member.id);
      onClose();
    } catch {
      // Shown below.
    }
  }
  return (
    <Modal
      open
      title="Xóa thành viên?"
      description="Người này sẽ không đăng nhập được nữa. Giao dịch họ đã nhập vẫn được giữ lại."
      icon={
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"
        >
          <TrashIcon className="size-5" />
        </span>
      }
      onClose={onClose}
    >
      <p className="rounded-xl bg-stone-50 p-4 text-sm font-medium text-stone-900">
        {member.email}
      </p>
      {remove.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Không xóa được: {remove.error.message}
        </p>
      )}
      <div className="mt-5 flex gap-2 sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-11 flex-1 rounded-lg border border-stone-300 px-5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:flex-none"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={remove.isPending}
          className="h-11 flex-1 rounded-lg bg-red-600 px-6 text-sm font-semibold text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-70 sm:flex-none"
        >
          {remove.isPending ? 'Đang xóa…' : 'Xóa thành viên'}
        </button>
      </div>
    </Modal>
  );
}

const ROLE_EXPLAINED: { role: MemberRole; text: string }[] = [
  { role: 'owner', text: 'Toàn quyền, mời và quản lý thành viên.' },
  { role: 'editor', text: 'Thêm, sửa, xóa giao dịch như chủ sở hữu.' },
  { role: 'viewer', text: 'Xem giá và lời/lỗ, không thay đổi được gì.' },
];

/** "Thành viên": who shares this gold portfolio, and (for the owner) inviting and managing them. */
export function MembersPage() {
  const household = useHousehold();
  const [removing, setRemoving] = useState<HouseholdMemberDto | null>(null);

  if (household.isPending) {
    return <p className="text-stone-600">Đang tải…</p>;
  }
  if (household.isError) {
    return (
      <p
        role="alert"
        className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700"
      >
        <AlertIcon className="size-4" />
        Không tải được danh sách thành viên: {household.error.message}
      </p>
    );
  }

  const { members, invites, yourRole } = household.data;
  const manage = canManageMembers(yourRole);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <UsersIcon className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Thành viên gia đình</h1>
          <p className="text-sm text-stone-500">
            Mọi thành viên cùng xem một danh mục vàng. Quyền của bạn: {ROLE_LABELS[yourRole]}.
          </p>
        </div>
      </div>

      {manage && (
        <Card
          title="Mời thành viên"
          description="Người được mời nhận email, đặt mật khẩu và thấy ngay danh mục của gia đình."
        >
          <InviteForm />
        </Card>
      )}

      <Card title={`Thành viên (${members.length})`}>
        <ul className="-my-3 divide-y divide-stone-100" aria-label="Thành viên">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} manage={manage} onRemove={setRemoving} />
          ))}
        </ul>
      </Card>

      {manage && invites.length > 0 && (
        <Card title={`Lời mời đang chờ (${invites.length})`}>
          <ul className="-my-3 divide-y divide-stone-100" aria-label="Lời mời đang chờ">
            {invites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </ul>
        </Card>
      )}

      <section className="rounded-2xl bg-stone-100/70 p-5 text-sm">
        <h2 className="font-semibold text-stone-800">Các loại quyền</h2>
        <dl className="mt-3 space-y-2">
          {ROLE_EXPLAINED.map(({ role, text }) => (
            <div key={role} className="flex flex-wrap items-center gap-2">
              <dt>
                <RoleBadge role={role} />
              </dt>
              <dd className="text-stone-600">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {removing && <RemoveMemberDialog member={removing} onClose={() => setRemoving(null)} />}
    </div>
  );
}
