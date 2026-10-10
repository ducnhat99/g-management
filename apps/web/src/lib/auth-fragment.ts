/**
 * What Supabase put in the URL fragment (`#…`) when it redirected back after an email link it
 * verified itself (its default email templates). A server route never sees the fragment, so
 * /auth/accept reads it in the browser.
 */
export type AuthFragment =
  | { kind: 'session'; accessToken: string; refreshToken: string; type: string | null }
  | { kind: 'error'; code: string | null; description: string | null }
  | { kind: 'none' };

export function parseAuthFragment(hash: string): AuthFragment {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const error = params.get('error') ?? params.get('error_code');
  if (error) {
    return {
      kind: 'error',
      code: params.get('error_code') ?? error,
      description: params.get('error_description'),
    };
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'session', accessToken, refreshToken, type: params.get('type') };
  }
  return { kind: 'none' };
}

/** Where to go once signed in: invites and password resets first choose a password. */
export function afterEmailLink(type: string | null): string {
  return type === 'invite' || type === 'recovery' ? '/set-password' : '/dashboard';
}

/** A Vietnamese explanation for a failed email link. */
export function emailLinkProblem(code: string | null): string {
  if (code === 'otp_expired') {
    return 'Liên kết trong email đã hết hạn hoặc đã được dùng.';
  }
  return 'Liên kết trong email không còn hợp lệ.';
}
