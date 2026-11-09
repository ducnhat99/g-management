// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { calculatePriceStats, formatVND, type PriceStatsSnapshot } from '@gold/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceStatistics } from './price-statistics';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api', () => ({ getApi: () => api }));

const vnd = (amount: number) => formatVND(amount).replace(/\s/g, ' ');
const NOW = new Date('2026-11-09T07:00:00Z');

const snap = (iso: string, buyPrice: number, sellPrice: number): PriceStatsSnapshot => ({
  sourceUpdatedAt: iso,
  buyPrice,
  sellPrice,
});

// Oct 2026 closes at 12.5M; then 07/11, nothing on 08/11, 09/11.
const SNAPSHOTS = [
  snap('2025-12-20T03:00:00Z', 10_000_000, 10_300_000),
  snap('2026-10-20T03:00:00Z', 12_500_000, 12_800_000),
  snap('2026-11-07T03:00:00Z', 13_000_000, 13_300_000),
  snap('2026-11-09T03:00:00Z', 13_130_000, 13_400_000),
];

function renderPage(snapshots = SNAPSHOTS) {
  api.get.mockResolvedValue(calculatePriceStats(snapshots, NOW));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PriceStatistics />
    </QueryClientProvider>,
  );
}

function card(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

describe('PriceStatistics', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it('loads GET /prices/stats and shows today, month and year changes on the buy price', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Thống kê giá' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/prices/stats');

    // 09/11 vs 08/11 (carried from 07/11): +130.000 / 13.000.000 = +1%.
    expect(within(card('Hôm nay so với hôm qua')).getByText('▲ +1,00%')).toBeInTheDocument();
    expect(
      within(card('Hôm nay so với hôm qua')).getByText(
        `+${vnd(130_000)}/chỉ · chốt ${vnd(13_130_000)}`,
      ),
    ).toBeInTheDocument();
    // Nov vs Oct: 630.000 / 12.500.000 = 5,04 %.
    expect(within(card('Tháng này so với tháng trước')).getByText('▲ +5,04%')).toBeInTheDocument();
    // 2026 vs 2025: 3.130.000 / 10.000.000 = 31,3 %.
    expect(within(card('Năm nay so với năm trước')).getByText('▲ +31,30%')).toBeInTheDocument();
  });

  it('switches the cards and table to the sell price', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Thống kê giá' });
    await userEvent.click(screen.getByRole('button', { name: 'Giá bán ra' }));
    expect(screen.getByRole('button', { name: 'Giá bán ra' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // 100.000 / 13.300.000 = 0,7519 %.
    expect(within(card('Hôm nay so với hôm qua')).getByText('▲ +0,75%')).toBeInTheDocument();
    expect(screen.getByText('Thay đổi tính theo giá bán ra')).toBeInTheDocument();
  });

  it('marks days with no update in the chart and the table', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Thống kê giá' });
    const table = screen.getByRole('table');
    const row = within(table).getByRole('rowheader', { name: /CN, 08\/11\/2026/ });
    expect(row).toHaveTextContent('Không có cập nhật');
    expect(screen.getAllByTestId('dot').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('dot-missing').length).toBeGreaterThan(0);
  });

  it('shows 10 days, then all 30 after "Xem thêm"', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Thống kê giá' });
    const body = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(body()).toHaveLength(10);
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm 20 ngày' }));
    expect(body()).toHaveLength(30);
  });

  it('also lists the periods as a phone-friendly list, newest first', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Thống kê giá' });
    const items = within(screen.getByRole('list', { name: 'Chi tiết theo ngày' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(10);
    expect(items[0]).toHaveTextContent(
      `T2, 09/11/2026▲ +1,00%Mua ${vnd(13_130_000)} · Bán ${vnd(13_400_000)}+${vnd(130_000)}`,
    );
  });

  it('switches to months and years', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Thống kê giá' });
    await userEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    expect(screen.getByRole('heading', { name: 'Chi tiết theo tháng' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Tháng 11/2026' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Năm' }));
    expect(screen.getAllByRole('rowheader').map((r) => r.textContent)).toEqual([
      'Năm 2026',
      'Năm 2025',
    ]);
    expect(screen.getByText('Từ 2025 đến nay')).toBeInTheDocument();
  });

  it('shows the empty state with fewer than 2 snapshots', async () => {
    renderPage(SNAPSHOTS.slice(3));
    expect(
      await screen.findByRole('heading', { name: 'Chưa đủ dữ liệu để thống kê' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(card('Hôm nay so với hôm qua')).getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về Tổng quan' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('shows an error with a retry button', async () => {
    api.get.mockRejectedValue(new Error('API down'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PriceStatistics />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được thống kê: API down');
  });
});
