// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import type { HouseholdDto } from '@gold/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { MembersPage } from './members-page';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ getApi: () => api }));

const OWNER_VIEW: HouseholdDto = {
  id: 'h1',
  name: 'Gia đình',
  yourRole: 'owner',
  members: [
    {
      id: 'm1',
      userId: 'u1',
      email: 'chong@example.com',
      role: 'owner',
      isYou: true,
      joinedAt: '2026-10-01T02:00:00Z',
    },
    {
      id: 'm2',
      userId: 'u2',
      email: 'vo@example.com',
      role: 'editor',
      isYou: false,
      joinedAt: '2026-10-05T02:00:00Z',
    },
  ],
  invites: [
    {
      id: 'i1',
      email: 'em@example.com',
      role: 'viewer',
      invitedAt: '2026-10-09T02:00:00Z',
      expiresAt: '2026-10-10T02:00:00Z',
      isExpired: true,
    },
  ],
};

function renderPage(data: HouseholdDto = OWNER_VIEW) {
  api.get.mockResolvedValue(data);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MembersPage />
    </QueryClientProvider>,
  );
}

describe('MembersPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('lists members with the owner marked as you', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Thành viên' });
    expect(within(list).getByText(/chong@example.com/)).toHaveTextContent('(Bạn)');
    expect(within(list).getByText('Chủ sở hữu')).toBeInTheDocument();
    expect(screen.getByText(/Quyền của bạn: Chủ sở hữu/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/household');
  });

  it('invites by email with the chosen role', async () => {
    const user = userEvent.setup();
    renderPage();
    api.post.mockResolvedValue({});
    await user.type(await screen.findByLabelText('Email người được mời'), ' Vo2@Example.com ');
    await user.click(screen.getByLabelText('Chỉ xem'));
    await user.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    expect(api.post).toHaveBeenCalledWith('/household/invites', {
      email: 'vo2@example.com',
      role: 'viewer',
    });
    expect(await screen.findByText(/Đã gửi lời mời tới vo2@example.com/)).toBeInTheDocument();
  });

  it('validates the email before sending', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Email người được mời'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email không hợp lệ');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the API reason when an invite is refused', async () => {
    const user = userEvent.setup();
    renderPage();
    api.post.mockRejectedValue(
      new ApiError(
        409,
        { message: 'Người này đã là thành viên của gia đình.' },
        'Người này đã là thành viên của gia đình.',
      ),
    );
    await user.type(await screen.findByLabelText('Email người được mời'), 'vo@example.com');
    await user.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('đã là thành viên');
  });

  it('changes a member role', async () => {
    const user = userEvent.setup();
    renderPage();
    api.patch.mockResolvedValue({});
    await user.selectOptions(await screen.findByLabelText('Quyền của vo@example.com'), 'viewer');
    expect(api.patch).toHaveBeenCalledWith('/household/members/m2', { role: 'viewer' });
  });

  it('removes a member after confirming', async () => {
    const user = userEvent.setup();
    renderPage();
    api.delete.mockResolvedValue(undefined);
    await user.click(
      await screen.findByRole('button', { name: 'Xóa vo@example.com khỏi gia đình' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Xóa thành viên?' });
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Xóa thành viên' }));
    expect(api.delete).toHaveBeenCalledWith('/household/members/m2');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('resends or cancels a pending invite', async () => {
    const user = userEvent.setup();
    renderPage();
    const invites = await screen.findByRole('list', { name: 'Lời mời đang chờ' });
    expect(within(invites).getByText('Liên kết đã hết hạn')).toBeInTheDocument();

    api.post.mockResolvedValue({});
    await user.click(
      within(invites).getByRole('button', { name: 'Gửi lại lời mời cho em@example.com' }),
    );
    expect(api.post).toHaveBeenCalledWith('/household/invites/i1/resend');

    api.delete.mockResolvedValue(undefined);
    await user.click(
      within(invites).getByRole('button', { name: 'Hủy lời mời cho em@example.com' }),
    );
    expect(api.delete).toHaveBeenCalledWith('/household/invites/i1');
  });

  it('shows members read-only to someone who is not the owner', async () => {
    renderPage({ ...OWNER_VIEW, yourRole: 'editor', invites: [] });
    const list = await screen.findByRole('list', { name: 'Thành viên' });
    expect(within(list).getByText('Có thể chỉnh sửa')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email người được mời')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /khỏi gia đình/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Lời mời đang chờ' })).not.toBeInTheDocument();
  });
});
