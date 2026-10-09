'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
      className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100 disabled:opacity-60"
    >
      {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
    </button>
  );
}
