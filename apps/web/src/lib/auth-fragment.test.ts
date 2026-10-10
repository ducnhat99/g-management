import { describe, expect, it } from 'vitest';
import { afterEmailLink, emailLinkProblem, parseAuthFragment } from './auth-fragment';

describe('parseAuthFragment', () => {
  it('reads the session Supabase sends after an invite link', () => {
    expect(
      parseAuthFragment(
        '#access_token=at&expires_in=3600&refresh_token=rt&token_type=bearer&type=invite',
      ),
    ).toEqual({ kind: 'session', accessToken: 'at', refreshToken: 'rt', type: 'invite' });
  });

  it('reads an error such as an expired link', () => {
    expect(
      parseAuthFragment(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({
      kind: 'error',
      code: 'otp_expired',
      description: 'Email link is invalid or has expired',
    });
  });

  it.each(['', '#', '#foo=bar', '#access_token=only'])('finds nothing usable in %j', (hash) => {
    expect(parseAuthFragment(hash)).toEqual({ kind: 'none' });
  });
});

describe('afterEmailLink / emailLinkProblem', () => {
  it('sends invites and password resets to choose a password', () => {
    expect(afterEmailLink('invite')).toBe('/set-password');
    expect(afterEmailLink('recovery')).toBe('/set-password');
    expect(afterEmailLink('magiclink')).toBe('/dashboard');
    expect(afterEmailLink(null)).toBe('/dashboard');
  });

  it('explains expired links specifically', () => {
    expect(emailLinkProblem('otp_expired')).toMatch(/hết hạn/);
    expect(emailLinkProblem(null)).toMatch(/không còn hợp lệ/);
  });
});
