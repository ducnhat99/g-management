export const DEFAULT_AFTER_LOGIN = '/dashboard';

/**
 * The `?next=` path to return to after login, only if it is a path on this site. Anything else
 * ("https://evil.com", "//evil.com", "/\\evil.com") falls back to the dashboard.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (next === '/login' || next.startsWith('/login?')) {
    return DEFAULT_AFTER_LOGIN;
  }
  return next;
}
