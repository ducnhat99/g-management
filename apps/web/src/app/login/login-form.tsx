'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    });
    if (error) {
      setError(
        error.code === 'invalid_credentials'
          ? 'Email hoặc mật khẩu không đúng.'
          : `Không đăng nhập được: ${error.message}`,
      );
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Mật khẩu</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
  );
}
