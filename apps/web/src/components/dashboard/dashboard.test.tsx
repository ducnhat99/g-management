// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  calculatePortfolio,
  formatVND,
  todayInVietnam,
  type PortfolioSummaryDto,
  type PriceDto,
  type PurchaseDto,
} from '@gold/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './dashboard';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ getApi: () => api }));

/** formatVND with the non-breaking space normalized, as Testing Library compares text. */
const vnd = (amount: number) => formatVND(amount).replace(/\s/g, ' ');

const purchase = (id: string, quantityChi: string, unitPrice: number, purchasedAt: string) =>
  ({
    id,
    quantityChi,
    unitPrice,
    totalCost: 0,
    purchasedAt,
    note: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }) satisfies PurchaseDto;

const price = (overrides: Partial<PriceDto> = {}): PriceDto => ({
  buyPrice: 13_240_000,
  sellPrice: 13_350_000,
  spread: 110_000,
  sourceUpdatedAt: '2026-10-09T02:15:00.000Z',
  checkedAt: new Date().toISOString(),
  nextRefreshAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  isStale: false,
  refreshError: null,
  ...overrides,
});

/** The Phase 5 test case, computed by the real shared calculation. */
function summary(p: PriceDto | null = price(), priceError: string | null = null) {
  const lots = [
    purchase('lot-2', '3', 13_000_000, '2026-06-01'),
    purchase('lot-1', '5', 12_000_000, '2026-01-15'),
  ];
  return {
    price: p,
    priceError,
    portfolio: calculatePortfolio(lots, p?.buyPrice ?? null, todayInVietnam()),
  } satisfies PortfolioSummaryDto;
}

function renderDashboard(data: PortfolioSummaryDto = summary()) {
  api.get.mockResolvedValue(data);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

/** Text of the element whose label is `label` inside the summary cards. */
const card = (label: string) =>
  within(screen.getByRole('region', { name: 'Tổng quan' })).getByText(label).parentElement!;

describe('Dashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('loads GET /portfolio/summary and shows the Phase 5 numbers', async () => {
    renderDashboard();
    await screen.findByText('Giao dịch');
    expect(api.get).toHaveBeenCalledWith('/portfolio/summary');

    expect(card('Tổng vàng')).toHaveTextContent('8 chỉ');
    expect(card('Tổng vốn')).toHaveTextContent(vnd(99_000_000));
    expect(card('Tổng vốn')).toHaveTextContent(`Hòa vốn khi mua vào ${vnd(12_375_000)}/chỉ`);
    expect(card('Giá trị hiện tại')).toHaveTextContent(vnd(105_920_000));
    expect(card('Lời/lỗ')).toHaveTextContent(`+${vnd(6_920_000)}(+6,99%)`);
    expect(card('Lời/lỗ').querySelector('.text-emerald-700')).not.toBeNull();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('01/06/2026');
    expect(rows[0]).toHaveTextContent(`+${vnd(720_000)}+1,85%`);
    expect(rows[1]).toHaveTextContent('15/01/2026');
    expect(rows[1]).toHaveTextContent(`+${vnd(6_200_000)}+10,33%`);
  });

  it('shows the Ngọc Thịnh price with both timestamps', async () => {
    renderDashboard();
    await screen.findByText('Mua vào');
    expect(screen.getAllByText(vnd(13_240_000)).length).toBeGreaterThan(0);
    expect(screen.getByText(vnd(13_350_000))).toBeInTheDocument();
    expect(screen.getByText('Ngọc Thịnh cập nhật lúc 09:15 09/10/2026')).toBeInTheDocument();
    expect(screen.getByText(/^Kiểm tra lúc \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
  });

  it('keeps "Làm mới" disabled with a countdown until nextRefreshAt', async () => {
    renderDashboard();
    const button = await screen.findByRole('button', { name: /Làm mới sau \d+:\d\d/ });
    expect(button).toBeDisabled();
  });

  it('enables "Làm mới" after nextRefreshAt and refreshes on click', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    renderDashboard(summary(price({ nextRefreshAt: past })));
    api.post.mockResolvedValue(price());
    const button = await screen.findByRole('button', { name: 'Làm mới' });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(api.post).toHaveBeenCalledWith('/prices/refresh');
    // Summary is reloaded after the refresh.
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('warns when the crawl failed or the source price is old', async () => {
    renderDashboard(summary(price({ refreshError: 'Timed out', isStale: true })));
    expect(
      await screen.findByText(/Không lấy được giá mới, đang dùng giá lúc/),
    ).toBeInTheDocument();
    expect(screen.getByText(/hơn 24 giờ chưa cập nhật/)).toBeInTheDocument();
  });

  it('still shows purchases and cost when there is no price at all', async () => {
    renderDashboard(summary(null, 'No price available yet: HTTP 503'));
    expect(await screen.findByText(/Chưa lấy được giá Ngọc Thịnh/)).toBeInTheDocument();
    expect(card('Tổng vốn')).toHaveTextContent(vnd(99_000_000));
    expect(card('Giá trị hiện tại')).toHaveTextContent('—');
  });

  it('adds a purchase: formats the price, previews profit/loss, posts the body', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Thêm giao dịch' }));
    const dialog = screen.getByRole('dialog', { name: 'Thêm giao dịch' });

    await user.type(within(dialog).getByLabelText('Số lượng'), '0,5');
    const priceInput = within(dialog).getByLabelText('Giá mua (VNĐ/chỉ)');
    await user.type(priceInput, '13350000');
    expect(priceInput).toHaveValue('13.350.000');
    expect(within(dialog).getByLabelText('Ngày mua')).toHaveValue(todayInVietnam());

    expect(dialog).toHaveTextContent(`Tổng tiền${vnd(6_675_000)}`);
    expect(dialog).toHaveTextContent(`Lời/lỗ ước tính${vnd(-55_000)} (-0,82%)`);

    api.post.mockResolvedValue(purchase('new', '0.5', 13_350_000, todayInVietnam()));
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(api.post).toHaveBeenCalledWith('/purchases', {
      quantity: '0.5',
      unit: 'chi',
      unitPrice: 13_350_000,
      purchasedAt: todayInVietnam(),
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not submit an invalid form and shows the field errors', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Thêm giao dịch' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(within(dialog).getByText('Nhập số lượng')).toBeInTheDocument();
    expect(within(dialog).getByText('Nhập giá mua')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows API validation errors on the matching field', async () => {
    const { ApiError } = await import('@/lib/api-client');
    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Thêm giao dịch' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Số lượng'), '1');
    await user.type(within(dialog).getByLabelText('Giá mua (VNĐ/chỉ)'), '13000000');
    api.post.mockRejectedValue(
      new ApiError(400, { issues: [{ path: 'purchasedAt', message: 'Ngày lỗi từ API' }] }, 'x'),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(await within(dialog).findByText('Ngày lỗi từ API')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('edits a purchase with every field, quantity in chỉ', async () => {
    const user = userEvent.setup();
    renderDashboard();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Sửa giao dịch ngày 15/01/2026' }));
    const dialog = screen.getByRole('dialog', { name: 'Sửa giao dịch' });
    expect(within(dialog).getByLabelText('Số lượng')).toHaveValue('5');
    expect(within(dialog).getByLabelText('Giá mua (VNĐ/chỉ)')).toHaveValue('12.000.000');

    api.patch.mockResolvedValue(purchase('lot-1', '1', 12_000_000, '2026-01-15'));
    await user.click(within(dialog).getByRole('button', { name: 'cây' }));
    await user.clear(within(dialog).getByLabelText('Số lượng'));
    await user.type(within(dialog).getByLabelText('Số lượng'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(api.patch).toHaveBeenCalledWith('/purchases/lot-1', {
      quantity: '1',
      unit: 'cay',
      unitPrice: 12_000_000,
      purchasedAt: '2026-01-15',
      note: null,
    });
  });

  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    renderDashboard();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Xóa giao dịch ngày 15/01/2026' }));
    const dialog = screen.getByRole('dialog', { name: 'Xóa giao dịch?' });
    expect(api.delete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();

    await user.click(within(table).getByRole('button', { name: 'Xóa giao dịch ngày 15/01/2026' }));
    api.delete.mockResolvedValue(undefined);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xóa' }));
    expect(api.delete).toHaveBeenCalledWith('/purchases/lot-1');
  });

  it('shows an empty state with no purchases', async () => {
    renderDashboard({
      price: price(),
      priceError: null,
      portfolio: calculatePortfolio([], 13_240_000, todayInVietnam()),
    });
    expect(await screen.findByText(/Chưa có giao dịch nào/)).toBeInTheDocument();
  });
});
