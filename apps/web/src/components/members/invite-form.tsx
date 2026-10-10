'use client';

import { inviteMemberSchema, ROLE_LABELS, type AssignableRole } from '@gold/shared';
import { useState, type FormEvent } from 'react';
import { AlertIcon, CheckCircleIcon, SendIcon } from '@/components/icons';
import { ApiError } from '@/lib/api-client';
import { useInviteMember } from '@/lib/queries';

const ROLE_HINTS: Record<AssignableRole, string> = {
  editor: 'Thêm, sửa, xóa giao dịch',
  viewer: 'Chỉ xem, không thay đổi được',
};

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    const issues = (error.body as { issues?: { message: string }[] } | null)?.issues;
    return issues?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Không gửi được lời mời.';
}

/** Owner only: invite someone by email with a role. Supabase sends the email. */
export function InviteForm() {
  const invite = useInviteMember();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('editor');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSentTo(null);
    const parsed = inviteMemberSchema.safeParse({ email, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Email không hợp lệ');
      return;
    }
    try {
      await invite.mutateAsync(parsed.data);
      setSentTo(parsed.data.email);
      setEmail('');
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium text-stone-700">
          Email người được mời
        </label>
        <input
          id="invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="vo@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'invite-error' : undefined}
          className="block h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-stone-900 placeholder:text-stone-400 transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:outline-none aria-invalid:border-red-400"
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-stone-700">Quyền</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['editor', 'viewer'] as const).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col rounded-xl border border-stone-200 p-3 transition has-checked:border-amber-500 has-checked:bg-amber-50 has-checked:ring-2 has-checked:ring-amber-100"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="invite-role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  aria-labelledby={`role-${value}-label`}
                  aria-describedby={`role-${value}-hint`}
                  className="accent-amber-600"
                />
                <span id={`role-${value}-label`} className="text-sm font-semibold text-stone-900">
                  {ROLE_LABELS[value]}
                </span>
              </span>
              <span id={`role-${value}-hint`} className="mt-1 pl-6 text-xs text-stone-500">
                {ROLE_HINTS[value]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p
          id="invite-error"
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      {sentTo && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
        >
          <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />
          Đã gửi lời mời tới {sentTo}. Liên kết trong email có hiệu lực 24 giờ.
        </p>
      )}

      <button
        type="submit"
        disabled={invite.isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-amber-500 to-amber-600 px-5 text-sm font-semibold text-white shadow-md shadow-amber-600/20 transition hover:from-amber-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {invite.isPending ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent"
          />
        ) : (
          <SendIcon className="size-4" />
        )}
        {invite.isPending ? 'Đang gửi…' : 'Gửi lời mời'}
      </button>
    </form>
  );
}
