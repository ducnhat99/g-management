import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FETCH_TIMEOUT_MS,
  NGOC_THINH_URL,
  fetchHtml,
  fetchQuote,
  parseQuote,
  parseUpdatedAt,
  parseVnd,
} from './ngocthinh';
import { PriceFetchError, PriceParseError } from './price-source';

// Real homepage saved on 2026-10-09. Every variant below edits a copy of it. Each of these strings
// appears exactly twice in the page, once per copy of the price table.
const FIXTURE = readFileSync(
  path.join(__dirname, '../../../test/fixtures/ngocthinh-2026-10-09.html'),
  'utf8',
);
const LABEL = 'Vàng 9999 (nhẫn tròn)';
const BUY = '13.260.000';
const SELL = '13.380.000';
const STAMP = '09:15 09/10/2026';
/** Shortly after the fixture's printed time. */
const NOW = new Date('2026-10-09T03:00:00Z');

const parse = (html: string) => parseQuote(html, NOW);
const replaceFirst = (html: string, from: string, to: string) => html.replace(from, to);

describe('parseVnd', () => {
  it('parses dot-grouped amounts', () => {
    expect(parseVnd('13.240.000')).toBe(13_240_000);
    expect(parseVnd(' 130.000 ')).toBe(130_000);
    expect(parseVnd(' 13.240.000 ')).toBe(13_240_000);
  });

  it.each(['', 'abc', '13,240,000', '13.24.000', '13 240 000', '-13.240.000', '13.240.000đ'])(
    'rejects %j',
    (text) => {
      expect(() => parseVnd(text)).toThrow(PriceParseError);
    },
  );
});

describe('parseUpdatedAt', () => {
  it('reads Vietnam time (+07:00)', () => {
    expect(parseUpdatedAt('09:06 07/10/2026').toISOString()).toBe('2026-10-07T02:06:00.000Z');
  });

  it('crosses the UTC date boundary for early-morning times', () => {
    expect(parseUpdatedAt('01:30 01/01/2026').toISOString()).toBe('2025-12-31T18:30:00.000Z');
  });

  it.each(['25:00 07/10/2026', '09:60 07/10/2026', '09:06 31/02/2026', '09:06 2026-10-07', ''])(
    'rejects %j',
    (text) => {
      expect(() => parseUpdatedAt(text)).toThrow(PriceParseError);
    },
  );
});

describe('parseQuote', () => {
  it('reads the 9999 nhẫn row from the real page', () => {
    expect(parse(FIXTURE)).toEqual({
      buyPrice: 13_260_000,
      sellPrice: 13_380_000,
      sourceUpdatedAt: new Date('2026-10-09T09:15:00+07:00'),
    });
  });

  it('does not pick the 98 or 96 nhẫn rows', () => {
    const { buyPrice } = parse(FIXTURE);
    expect(buyPrice).not.toBe(12_950_000);
    expect(buyPrice).not.toBe(12_650_000);
  });

  it('handles a label wrapped in &nbsp;', () => {
    const html = FIXTURE.replaceAll(LABEL, `&nbsp;${LABEL}&nbsp;`);
    expect(parse(html).buyPrice).toBe(13_260_000);
  });

  it('handles a label in Unicode NFD form', () => {
    const html = FIXTURE.replaceAll(LABEL, LABEL.normalize('NFD'));
    expect(LABEL.normalize('NFD')).not.toBe(LABEL);
    expect(parse(html).buyPrice).toBe(13_260_000);
  });

  it('fails when the 9999 row is missing', () => {
    const html = FIXTURE.replaceAll(LABEL, 'Vàng 999 (nhẫn tròn)');
    expect(() => parse(html)).toThrow(/found 0/);
  });

  it('fails when more than one row matches', () => {
    const html = FIXTURE.replaceAll('Vàng 98 (nhẫn tròn)', 'Vàng 9999 (nhẫn tròn) loại 2');
    expect(() => parse(html)).toThrow(/found 2/);
  });

  it('fails when the price table header is missing', () => {
    const html = FIXTURE.replaceAll('Loại vàng', 'Sản phẩm');
    expect(() => parse(html)).toThrow(/header .* not found/);
  });

  it('fails when the two table copies disagree on price', () => {
    const html = replaceFirst(FIXTURE, BUY, '13.270.000');
    expect(() => parse(html)).toThrow(/disagree/);
  });

  it('fails when the two copies disagree on update time', () => {
    const html = replaceFirst(FIXTURE, STAMP, '09:20 09/10/2026');
    expect(() => parse(html)).toThrow(/found 2/);
  });

  it('fails when the update time is missing', () => {
    const html = FIXTURE.replaceAll('CẬP NHẬT LÚC', 'GHI CHÚ');
    expect(() => parse(html)).toThrow(/found 0/);
  });

  it('fails on a malformed number', () => {
    const html = FIXTURE.replaceAll(BUY, '13,260,000');
    expect(() => parse(html)).toThrow(/Not a VND amount/);
  });

  it('fails when buy is above sell', () => {
    const html = FIXTURE.replaceAll(BUY, '13.480.000');
    expect(() => parse(html)).toThrow(/not below sell/);
  });

  it('fails when a price is outside 1.000.000–100.000.000', () => {
    const html = FIXTURE.replaceAll(BUY, '260.000');
    expect(() => parse(html)).toThrow(/outside/);
    expect(() => parse(FIXTURE.replaceAll(SELL, '133.800.000'))).toThrow(/outside/);
  });

  it('fails when the update time is more than 5 minutes in the future', () => {
    expect(() => parseQuote(FIXTURE, new Date('2026-10-09T02:09:00Z'))).toThrow(/future/);
    expect(parseQuote(FIXTURE, new Date('2026-10-09T02:11:00Z')).buyPrice).toBe(13_260_000);
  });

  it('throws PriceParseError on a page without any table', () => {
    expect(() => parse('<html><body>Bảo trì</body></html>')).toThrow(PriceParseError);
  });
});

describe('fetchHtml / fetchQuote', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a User-Agent and a timeout signal, and returns the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(FIXTURE, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHtml()).resolves.toBe(FIXTURE);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(NGOC_THINH_URL);
    expect(new Headers(init.headers).get('User-Agent')).toMatch(/^gold-tracker\//);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws PriceFetchError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));
    await expect(fetchHtml()).rejects.toThrow(PriceFetchError);
    await expect(fetchHtml()).rejects.toThrow(/HTTP 500/);
  });

  it('throws PriceFetchError on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(fetchHtml()).rejects.toThrow(/Network error/);
  });

  it('throws PriceFetchError on timeout', async () => {
    const timeout = new DOMException('The operation timed out.', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    await expect(fetchHtml()).rejects.toThrow(`Timed out after ${FETCH_TIMEOUT_MS} ms`);
  });

  it('fetchQuote parses the fetched page', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FIXTURE, { status: 200 })));
    try {
      await expect(fetchQuote()).resolves.toMatchObject({ buyPrice: 13_260_000 });
    } finally {
      vi.useRealTimers();
    }
  });
});
