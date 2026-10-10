// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatchGoldGame } from './catch-gold-game';

describe('CatchGoldGame', () => {
  beforeEach(() => {
    // jsdom has no canvas; the component then skips drawing (the engine is tested on its own).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the rules and a start button', () => {
    render(<CatchGoldGame />);
    expect(screen.getByRole('heading', { name: 'Hứng vàng' })).toBeInTheDocument();
    expect(screen.getByText('Nhẫn 9999: +1 chỉ')).toBeInTheDocument();
    expect(screen.getByText('Thỏi vàng: +1 cây')).toBeInTheDocument();
    expect(screen.getByText('Vàng giả: −2 chỉ')).toBeInTheDocument();
    expect(screen.getByText('Bom: −1 mạng')).toBeInTheDocument();
    expect(screen.getByText('Điểm:')).toHaveTextContent('Điểm: 0 chỉ');
    expect(screen.getByLabelText('Còn 3 mạng')).toBeInTheDocument();
  });

  it('starts a round when "Bắt đầu" is pressed', async () => {
    render(<CatchGoldGame />);
    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    expect(screen.queryByRole('heading', { name: 'Hứng vàng' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Trò chơi Hứng vàng/)).toBeInTheDocument();
  });

  it('shows the saved best score in cây/chỉ', () => {
    window.localStorage.setItem('catch-gold:best', '23');
    render(<CatchGoldGame />);
    expect(screen.getByText('Kỷ lục: 2 cây 3 chỉ')).toBeInTheDocument();
  });

  it('works when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<CatchGoldGame />);
    expect(screen.getByText('Kỷ lục: 0 chỉ')).toBeInTheDocument();
  });
});
