// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptLink } from './accept-link';

const mocks = vi.hoisted(() => ({ setSession: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ auth: { setSession: mocks.setSession } }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const openWithHash = (hash: string) => window.history.replaceState(null, '', `/auth/accept${hash}`);

describe('AcceptLink', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('stores the session from the fragment and continues to /set-password', async () => {
    mocks.setSession.mockResolvedValue({ error: null });
    openWithHash('#access_token=at&refresh_token=rt&type=invite');
    render(<AcceptLink />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang xác nhận lời mời');

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/set-password'));
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
    // The tokens do not stay in the address bar.
    expect(window.location.hash).toBe('');
  });

  it('explains an expired link and offers the way back', async () => {
    openWithHash('#error=access_denied&error_code=otp_expired&error_description=expired');
    render(<AcceptLink />);
    expect(await screen.findByRole('alert')).toHaveTextContent('đã hết hạn');
    expect(screen.getByRole('link', { name: 'Về trang đăng nhập' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('explains a link without anything usable', async () => {
    openWithHash('');
    render(<AcceptLink />);
    expect(await screen.findByRole('alert')).toHaveTextContent('không còn hợp lệ');
  });

  it('explains when Supabase rejects the session', async () => {
    mocks.setSession.mockResolvedValue({ error: { message: 'Invalid Refresh Token' } });
    openWithHash('#access_token=at&refresh_token=bad&type=invite');
    render(<AcceptLink />);
    expect(await screen.findByRole('alert')).toHaveTextContent('không còn hợp lệ');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
