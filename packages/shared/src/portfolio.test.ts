import { describe, expect, it } from 'vitest';
import {
  calculatePortfolio,
  formatChi,
  formatPercent,
  formatVND,
  type PortfolioLotInput,
} from './portfolio';

const TODAY = '2026-10-09';
const lot = (
  id: string,
  quantityChi: string,
  unitPrice: number,
  purchasedAt = '2026-10-01',
): PortfolioLotInput => ({ id, quantityChi, unitPrice, purchasedAt });

describe('calculatePortfolio', () => {
  it('matches the hand-checked case from the plan', () => {
    const { totals, lots } = calculatePortfolio(
      [lot('a', '5', 12_000_000, '2026-01-15'), lot('b', '3', 13_000_000, '2026-06-01')],
      13_240_000,
      TODAY,
    );
    expect(totals).toEqual({
      quantityChi: '8',
      quantityLabel: '8 chỉ',
      cost: 99_000_000,
      avgCostPerChi: 12_375_000,
      value: 105_920_000,
      pnl: 6_920_000,
      pnlPct: 6.99,
    });
    expect(lots.map(({ cost, value, pnl, pnlPct }) => ({ cost, value, pnl, pnlPct }))).toEqual([
      { cost: 60_000_000, value: 66_200_000, pnl: 6_200_000, pnlPct: 10.33 },
      { cost: 39_000_000, value: 39_720_000, pnl: 720_000, pnlPct: 1.85 },
    ]);
  });

  it('handles a loss with a fractional quantity (0.5 chỉ)', () => {
    const { totals, lots } = calculatePortfolio([lot('a', '0.5', 13_350_000)], 13_240_000, TODAY);
    expect(lots[0]).toMatchObject({
      cost: 6_675_000,
      value: 6_620_000,
      pnl: -55_000,
      pnlPct: -0.82,
    });
    expect(totals).toMatchObject({
      quantityChi: '0.5',
      quantityLabel: '0,5 chỉ',
      pnl: -55_000,
      pnlPct: -0.82,
      avgCostPerChi: 13_350_000,
    });
  });

  it('rounds each lot half-up to whole đồng', () => {
    const { lots } = calculatePortfolio([lot('a', '0.001', 13_240_500)], 13_240_500, TODAY);
    expect(lots[0]).toMatchObject({ cost: 13_241, value: 13_241, pnl: 0, pnlPct: 0 });
  });

  it('keeps totals equal to the sum of the rounded lots', () => {
    const lots = [lot('a', '0.001', 13_240_500), lot('b', '0.001', 13_240_500)];
    const { totals } = calculatePortfolio(lots, 13_240_500, TODAY);
    expect(totals.cost).toBe(26_482); // 2 × 13.241, not round(26.481)
    expect(totals.value).toBe(26_482);
  });

  it('parses quantities as strings, not floats', () => {
    // 1.005 * 1000 is 1004.9999… as a float.
    const { totals } = calculatePortfolio([lot('a', '1.005', 10_000_000)], 10_000_000, TODAY);
    expect(totals).toMatchObject({ quantityChi: '1.005', cost: 10_050_000 });
  });

  it('returns zeros and nulls for an empty portfolio', () => {
    expect(calculatePortfolio([], 13_240_000, TODAY)).toEqual({
      totals: {
        quantityChi: '0',
        quantityLabel: '0 chỉ',
        cost: 0,
        avgCostPerChi: null,
        value: 0,
        pnl: 0,
        pnlPct: null,
      },
      lots: [],
    });
  });

  it('still reports cost when there is no price', () => {
    const { totals, lots } = calculatePortfolio([lot('a', '5', 12_000_000)], null, TODAY);
    expect(totals).toMatchObject({ cost: 60_000_000, value: null, pnl: null, pnlPct: null });
    expect(lots[0]).toMatchObject({ cost: 60_000_000, value: null, pnl: null, pnlPct: null });
  });

  it('counts holding days in calendar days', () => {
    const { lots } = calculatePortfolio(
      [lot('a', '1', 12_000_000, TODAY), lot('b', '1', 12_000_000, '2026-09-09')],
      13_000_000,
      TODAY,
    );
    expect(lots.map((l) => l.holdingDays)).toEqual([0, 30]);
  });

  it('rounds the break-even price half-up', () => {
    // (12.000.000 + 13.000.001) / 2 = 12.500.000,5
    const { totals } = calculatePortfolio(
      [lot('a', '1', 12_000_000), lot('b', '1', 13_000_001)],
      13_000_000,
      TODAY,
    );
    expect(totals.avgCostPerChi).toBe(12_500_001);
  });
});

describe('formatChi', () => {
  it.each([
    [13, '1 cây 3 chỉ'],
    [10, '1 cây'],
    [0.5, '0,5 chỉ'],
    ['12.5', '1 cây 2,5 chỉ'],
    ['20', '2 cây'],
    ['0.285', '0,285 chỉ'],
    [0, '0 chỉ'],
  ])('%j -> %s', (input, text) => {
    expect(formatChi(input)).toBe(text);
  });
});

describe('formatVND', () => {
  it('formats with Vietnamese grouping', () => {
    expect(formatVND(13_240_000).replace(/\s/g, ' ')).toBe('13.240.000 ₫');
    expect(formatVND(-55_000).replace(/\s/g, ' ')).toBe('-55.000 ₫');
  });
});

describe('formatPercent', () => {
  it('uses a decimal comma and an optional sign', () => {
    expect(formatPercent(6.99)).toBe('6,99%');
    expect(formatPercent(6.99, { sign: true })).toBe('+6,99%');
    expect(formatPercent(-0.82, { sign: true })).toBe('-0,82%');
    expect(formatPercent(0, { sign: true })).toBe('0,00%');
  });
});
