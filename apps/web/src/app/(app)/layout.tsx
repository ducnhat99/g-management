import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { siteTitle } from '@/lib/site';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';

/** Layout for every signed-in page. proxy.ts already redirects; this re-checks on the server. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect('/login');
  }
  const email = typeof data.claims.email === 'string' ? data.claims.email : null;

  return (
    <>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="font-semibold">
            {siteTitle}
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {email && <span className="hidden text-stone-600 sm:inline">{email}</span>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}
