import { type NextRequest } from 'next/server';
import { DEFAULT_AFTER_LOGIN } from './lib/safe-next-path';
import { redirectKeepingCookies, updateSession } from './lib/supabase/proxy';

const LOGIN_PATH = '/login';

/** Refreshes the session on every page request; every page except /login requires sign-in. */
export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!claims && pathname !== LOGIN_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = new URLSearchParams({ next: pathname + search }).toString();
    return redirectKeepingCookies(url, response);
  }

  if (claims && pathname === LOGIN_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AFTER_LOGIN;
    url.search = '';
    return redirectKeepingCookies(url, response);
  }

  return response;
}

export const config = {
  // Skip static assets, image optimization and files with an extension (favicon.ico, *.png, ...).
  matcher: ['/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
};
