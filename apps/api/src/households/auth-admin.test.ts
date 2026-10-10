import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthAdminError, SupabaseAuthAdmin } from './auth-admin';

const URL = 'https://ref.supabase.co';
const KEY = 'sb_secret_test';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('SupabaseAuthAdmin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('invites through the auth admin endpoint with the secret key headers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(200, { id: 'user-1', email: 'vo@example.com' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new SupabaseAuthAdmin(URL, KEY).inviteUserByEmail(
      'vo@example.com',
      'https://web.test/auth/confirm',
    );
    expect(result).toEqual({ userId: 'user-1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `${URL}/auth/v1/invite?redirect_to=${encodeURIComponent('https://web.test/auth/confirm')}`,
    );
    const headers = new Headers(init.headers);
    expect(headers.get('apikey')).toBe(KEY);
    expect(headers.get('Authorization')).toBe(`Bearer ${KEY}`);
  });

  it('maps "already registered" to its own error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(422, {
          code: 'email_exists',
          msg: 'A user with this email address has already been registered',
        }),
      ),
    );
    await expect(
      new SupabaseAuthAdmin(URL, KEY).inviteUserByEmail('vo@example.com', 'https://web.test'),
    ).rejects.toMatchObject({ code: 'already_registered' });
  });

  it('turns a network failure into AuthAdminError instead of a bare error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const error = await new SupabaseAuthAdmin(URL, KEY)
      .inviteUserByEmail('vo@example.com', 'https://web.test')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthAdminError);
    expect(error).toMatchObject({ code: 'failed' });
  });

  it('explains when the secret key is not configured', async () => {
    await expect(
      new SupabaseAuthAdmin(URL, undefined).inviteUserByEmail('vo@example.com', 'https://web.test'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ignores deleting a user that no longer exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(404, { code: 'user_not_found', msg: 'User not found' })),
    );
    await expect(
      new SupabaseAuthAdmin(URL, KEY).deleteUser('3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90'),
    ).resolves.toBeUndefined();
  });
});
