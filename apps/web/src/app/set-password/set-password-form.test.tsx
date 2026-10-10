// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { passwordProblem, SetPasswordForm } from './set-password-form';

const mocks = vi.hoisted(() => ({ updateUser: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ auth: { updateUser: mocks.updateUser } }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

describe('passwordProblem', () => {
  it('needs 8+ characters and matching fields', () => {
    expect(passwordProblem('short', 'short')).toMatch(/ít nhất 8/);
    expect(passwordProblem('longenough', 'different1')).toMatch(/chưa khớp/);
    expect(passwordProblem('longenough', 'longenough')).toBeNull();
  });
});

describe('SetPasswordForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  async function submit(password: string, confirm: string) {
    const user = userEvent.setup();
    render(<SetPasswordForm />);
    await user.type(screen.getByLabelText('Mật khẩu mới'), password);
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), confirm);
    await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu và vào app' }));
  }

  it('saves the password and opens the shared dashboard', async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    await submit('vang9999!', 'vang9999!');
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'vang9999!' });
    expect(mocks.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('does not call Supabase when the passwords do not match', async () => {
    await submit('vang9999!', 'vang9998!');
    expect(await screen.findByRole('alert')).toHaveTextContent('chưa khớp');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('shows a Supabase error', async () => {
    mocks.updateUser.mockResolvedValue({ error: { message: 'Password is too weak' } });
    await submit('vang9999!', 'vang9999!');
    expect(await screen.findByRole('alert')).toHaveTextContent('Password is too weak');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
