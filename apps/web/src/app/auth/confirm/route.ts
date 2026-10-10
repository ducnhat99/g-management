import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { afterEmailLink } from '@/lib/auth-fragment';
import { safeNextPath } from '@/lib/safe-next-path';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Email link types this route accepts. invite and recovery continue to /set-password. */
const ALLOWED_TYPES: readonly EmailOtpType[] = ['invite', 'recovery', 'email', 'magiclink'];

/**
 * Landing route for Supabase email links. Public in proxy.ts. Handles both link styles:
 * - custom template, `?token_hash=…&type=invite`: verify the one-time token here on the server,
 *   which signs the person in by setting the session cookies;
 * - Supabase's default template: Supabase verified the link itself and redirects here with the
 *   session in the URL fragment (`#access_token=…`), which only the browser can read. Redirect to
 *   /auth/accept without a fragment: browsers keep the original fragment across the redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const supabaseError = searchParams.get('error_code') ?? searchParams.get('error');

  if (tokenHash) {
    if (type && ALLOWED_TYPES.includes(type)) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        const next =
          type === 'invite' || type === 'recovery'
            ? afterEmailLink(type)
            : safeNextPath(searchParams.get('next'));
        return NextResponse.redirect(new URL(next, request.url));
      }
    }
    return loginWithError(request);
  }

  if (supabaseError) {
    return loginWithError(request);
  }
  return NextResponse.redirect(new URL('/auth/accept', request.url));
}

function loginWithError(request: NextRequest) {
  const login = new URL('/login', request.url);
  login.searchParams.set('error', 'link');
  return NextResponse.redirect(login);
}
