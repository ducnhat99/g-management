// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ auth: { signInWithPassword: mocks.signInWithPassword } }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

async function fillAndSubmit(email = 'ban@example.com', password = 'secret123') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Mật khẩu'), password);
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  return user;
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('signs in and goes to the requested page', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm next="/dashboard?tab=lots" />);
    await fillAndSubmit('  ban@example.com ');
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'ban@example.com',
      password: 'secret123',
    });
    expect(mocks.replace).toHaveBeenCalledWith('/dashboard?tab=lots');
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('shows a Vietnamese message for wrong credentials and marks the fields', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } });
    render(<LoginForm next="/dashboard" />);
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('aria-describedby', 'login-error');
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
  });

  it('shows other auth errors with their message', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { code: 'over_request_rate_limit', message: 'Too many requests' },
    });
    render(<LoginForm next="/dashboard" />);
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không đăng nhập được: Too many requests',
    );
  });

  it('disables the button with a spinner label while signing in', async () => {
    mocks.signInWithPassword.mockReturnValue(new Promise(() => {}));
    render(<LoginForm next="/dashboard" />);
    await fillAndSubmit();
    expect(screen.getByRole('button', { name: 'Đang đăng nhập…' })).toBeDisabled();
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);
    const password = screen.getByLabelText('Mật khẩu');
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
