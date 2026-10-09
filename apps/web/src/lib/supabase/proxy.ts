import { createServerClient } from '@supabase/ssr';
import type { JwtPayload } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '../env';

/**
 * Refreshes the Supabase session cookies for this request and returns the verified claims (null
 * when signed out). The returned response carries any refreshed cookies and must be the one sent,
 * or copied into a redirect.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; claims: JwtPayload | null }> {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseKey } = publicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-Control etc., so a CDN never caches a response that sets auth cookies.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getClaims() verifies the JWT (against the project's JWKS) and refreshes an expired session.
  // Do not use getSession() here: it trusts the cookie without verifying it.
  const { data } = await supabase.auth.getClaims();
  return { response, claims: data?.claims ?? null };
}

/** A redirect that keeps the refreshed session cookies from `from`. */
export function redirectKeepingCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
