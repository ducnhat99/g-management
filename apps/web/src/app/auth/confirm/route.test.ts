import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyOtp = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp } }),
}));

const { GET } = await import('./route');

const get = (query: string) => GET(new NextRequest(`https://app.test/auth/confirm${query}`));
const location = (res: Response) => {
  const url = new URL(res.headers.get('location') ?? '');
  return url.pathname + url.search;
};

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    verifyOtp.mockReset();
  });

  describe('custom template (?token_hash=…)', () => {
    it('verifies an invite token and continues to /set-password', async () => {
      verifyOtp.mockResolvedValue({ error: null });
      const res = await get('?token_hash=abc&type=invite');
      expect(verifyOtp).toHaveBeenCalledWith({ type: 'invite', token_hash: 'abc' });
      expect(res.status).toBe(307);
      expect(location(res)).toBe('/set-password');
    });

    it('sends other link types to a safe next page', async () => {
      verifyOtp.mockResolvedValue({ error: null });
      expect(location(await get('?token_hash=abc&type=email&next=/members'))).toBe('/members');
      expect(location(await get('?token_hash=abc&type=email&next=//evil.example'))).toBe(
        '/dashboard',
      );
    });

    it('sends an expired or used link back to login with an explanation', async () => {
      verifyOtp.mockResolvedValue({ error: { message: 'Email link is invalid or has expired' } });
      expect(location(await get('?token_hash=abc&type=invite'))).toBe('/login?error=link');
    });

    it.each(['?token_hash=abc', '?token_hash=abc&type=signup_admin'])(
      'rejects %j without calling Supabase',
      async (query) => {
        expect(location(await get(query))).toBe('/login?error=link');
        expect(verifyOtp).not.toHaveBeenCalled();
      },
    );
  });

  describe("Supabase's default template (session in the #fragment)", () => {
    it.each(['', '?type=invite'])(
      'hands %j over to /auth/accept, which reads the fragment in the browser',
      async (query) => {
        const res = await get(query);
        expect(res.status).toBe(307);
        expect(location(res)).toBe('/auth/accept');
        expect(verifyOtp).not.toHaveBeenCalled();
      },
    );

    it('shows the login explanation when Supabase reports an error in the query', async () => {
      expect(location(await get('?error=access_denied&error_code=otp_expired'))).toBe(
        '/login?error=link',
      );
    });
  });
});
