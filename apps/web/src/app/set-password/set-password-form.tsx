'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AlertIcon } from '@/components/icons';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  'block h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-stone-900 transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:outline-none aria-invalid:border-red-400';

/** Checks the two fields; a Vietnamese message, or null when they are fine. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  }
  if (password !== confirm) {
    return 'Hai mật khẩu chưa khớp nhau.';
  }
  return null;
}

export function SetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const problem = passwordProblem(password, String(form.get('confirm') ?? ''));
    if (problem) {
      setError(problem);
      return;
    }

    setPending(true);
    setError(null);
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (error) {
      setError(`Không đặt được mật khẩu: ${error.message}`);
      setPending(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-stone-700">
          Mật khẩu mới
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-invalid={error ? true : undefined}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-stone-500">Ít nhất {MIN_PASSWORD_LENGTH} ký tự.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-stone-700">
          Nhập lại mật khẩu
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={error ? true : undefined}
          className={inputClass}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-amber-500 to-amber-600 font-semibold text-white shadow-md shadow-amber-600/20 transition hover:from-amber-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent"
          />
        )}
        {pending ? 'Đang lưu…' : 'Lưu mật khẩu và vào app'}
      </button>
    </form>
  );
}
