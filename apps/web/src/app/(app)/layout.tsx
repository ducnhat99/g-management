import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppLogo } from '@/components/app-logo';
import { siteTitle } from '@/lib/site';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';
import { MembersLink } from './members-link';

/** Layout for every signed-in page. proxy.ts already redirects; this re-checks on the server. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect('/login');
  }
  const email = typeof data.claims.email === 'string' ? data.claims.email : null;

  return (
    <div className="min-h-screen bg-linear-to-b from-amber-50/70 via-stone-50 to-stone-50">
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-stone-900">
            <AppLogo className="size-9" priority />
            {siteTitle}
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <MembersLink />
            {email && (
              <span className="hidden items-center gap-2 rounded-full bg-stone-100 py-1 pr-3 pl-1 text-sm text-stone-700 sm:flex">
                <span
                  aria-hidden="true"
                  className="flex size-6 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-amber-600 text-xs font-semibold text-white uppercase"
                >
                  {email.charAt(0)}
                </span>
                {email}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
