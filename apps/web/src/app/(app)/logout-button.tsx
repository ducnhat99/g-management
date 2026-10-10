'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogoutIcon } from '@/components/icons';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await getSupabaseBrowserClient().auth.signOut();
    // Drop cached API data so the next user never sees it.
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-60"
    >
      <LogoutIcon className="size-4" />
      {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
    </button>
  );
}
