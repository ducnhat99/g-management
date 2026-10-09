import { load, type CheerioAPI } from 'cheerio';
import { PriceFetchError, PriceParseError, type PriceQuote } from './price-source';

export const NGOC_THINH_URL = 'https://ngocthinh-jewelry.vn/';
export const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = 'gold-tracker/1.0 (personal use)';

const MIN_PRICE = 1_000_000;
const MAX_PRICE = 100_000_000;
/** Allowed clock skew between the site's printed time and ours. */
const MAX_FUTURE_MS = 5 * 60 * 1000;
/** Vietnam has no daylight saving time. */
const VIETNAM_UTC_OFFSET_HOURS = 7;

const HEADER = ['loại vàng', 'mua vào', 'bán ra'];

/** NFC (labels may arrive decomposed), &nbsp; to space, collapse whitespace, lowercase. */
function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** "13.240.000" -> 13240000. Only dot-grouped thousands are accepted. */
export function parseVnd(text: string): number {
  const normalized = normalizeText(text);
  if (!/^\d{1,3}(\.\d{3})*$/.test(normalized)) {
    throw new PriceParseError(`Not a VND amount: "${text}"`);
  }
  return Number(normalized.replaceAll('.', ''));
}

/** "09:06 07/10/2026" (Vietnam time) -> the matching UTC instant. */
export function parseUpdatedAt(text: string): Date {
  const match = /^(\d{1,2}):(\d{2}) (\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalizeText(text));
  if (!match) {
    throw new PriceParseError(`Not an update time: "${text}"`);
  }
  const [hour, minute, day, month, year] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const calendarDay = new Date(Date.UTC(year, month - 1, day));
  const validDay =
    calendarDay.getUTCFullYear() === year &&
    calendarDay.getUTCMonth() === month - 1 &&
    calendarDay.getUTCDate() === day;
  if (!validDay || hour > 23 || minute > 59) {
    throw new PriceParseError(`Invalid update time: "${text}"`);
  }
  return new Date(Date.UTC(year, month - 1, day, hour - VIETNAM_UTC_OFFSET_HOURS, minute));
}

/** Text of an element's 3 leaf children, or null if it is not shaped like a table row. */
function rowCells($: CheerioAPI, element: Parameters<CheerioAPI>[0]): string[] | null {
  const children = $(element).children().toArray();
  if (children.length !== 3 || children.some((child) => $(child).children().length > 0)) {
    return null;
  }
  return children.map((child) => $(child).text());
}

/**
 * Every copy of the price table, as rows of [label, buy, sell] cell text. A table is found by its
 * header row text ("Loại vàng / Mua vào / Bán ra"), never by CSS class.
 */
function findTables($: CheerioAPI): string[][][] {
  const tables: string[][][] = [];
  for (const element of $('*').toArray()) {
    const header = rowCells($, element);
    if (!header || header.map(normalizeText).join('|') !== HEADER.join('|')) {
      continue;
    }
    const rows = $(element)
      .parent()
      .find('*')
      .toArray()
      .filter((candidate) => candidate !== element)
      .map((candidate) => rowCells($, candidate))
      .filter((cells): cells is string[] => cells !== null);
    tables.push(rows);
  }
  return tables;
}

function isNhan9999(label: string): boolean {
  const normalized = normalizeText(label);
  return /\b9999\b/.test(normalized) && normalized.includes('nhẫn');
}

function quoteFromTable(rows: string[][]): { buyPrice: number; sellPrice: number } {
  const matches = rows.filter(([label]) => isNhan9999(label ?? ''));
  if (matches.length !== 1) {
    throw new PriceParseError(`Expected 1 "9999 nhẫn" row, found ${matches.length}`);
  }
  const [, buy, sell] = matches[0] as [string, string, string];
  return { buyPrice: parseVnd(buy), sellPrice: parseVnd(sell) };
}

function findUpdatedAt($: CheerioAPI): Date {
  const pattern = /cập nhật lúc\s*(\d{1,2}:\d{2} \d{1,2}\/\d{1,2}\/\d{4})/g;
  const stamps = new Set([...normalizeText($.root().text()).matchAll(pattern)].map((m) => m[1]));
  if (stamps.size !== 1) {
    throw new PriceParseError(`Expected 1 distinct "Cập nhật lúc" time, found ${stamps.size}`);
  }
  return parseUpdatedAt([...stamps][0] as string);
}

function validateQuote(quote: PriceQuote, now: Date): void {
  const { buyPrice, sellPrice, sourceUpdatedAt } = quote;
  for (const [name, price] of [
    ['buy', buyPrice],
    ['sell', sellPrice],
  ] as const) {
    if (price < MIN_PRICE || price > MAX_PRICE) {
      throw new PriceParseError(`${name} price ${price} is outside ${MIN_PRICE}–${MAX_PRICE}`);
    }
  }
  if (buyPrice >= sellPrice) {
    throw new PriceParseError(`Buy price ${buyPrice} is not below sell price ${sellPrice}`);
  }
  if (sourceUpdatedAt.getTime() > now.getTime() + MAX_FUTURE_MS) {
    throw new PriceParseError(`Update time ${sourceUpdatedAt.toISOString()} is in the future`);
  }
}

/** Extracts the "Vàng 9999 (nhẫn tròn)" quote. The page repeats the table; all copies must agree. */
export function parseQuote(html: string, now: Date = new Date()): PriceQuote {
  const $ = load(html);
  const tables = findTables($);
  if (tables.length === 0) {
    throw new PriceParseError('Price table header "Loại vàng / Mua vào / Bán ra" not found');
  }
  const quotes = tables.map(quoteFromTable);
  const [first] = quotes as [{ buyPrice: number; sellPrice: number }];
  if (quotes.some((q) => q.buyPrice !== first.buyPrice || q.sellPrice !== first.sellPrice)) {
    throw new PriceParseError(`Price table copies disagree: ${JSON.stringify(quotes)}`);
  }
  const quote: PriceQuote = { ...first, sourceUpdatedAt: findUpdatedAt($) };
  validateQuote(quote, now);
  return quote;
}

export async function fetchHtml(
  url: string = NGOC_THINH_URL,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new PriceFetchError(
      timedOut
        ? `Timed out after ${timeoutMs} ms fetching ${url}`
        : `Network error fetching ${url}`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new PriceFetchError(`HTTP ${response.status} from ${url}`);
  }
  try {
    return await response.text();
  } catch (error) {
    throw new PriceFetchError(`Failed to read the response body from ${url}`, { cause: error });
  }
}

export async function fetchQuote(): Promise<PriceQuote> {
  return parseQuote(await fetchHtml());
}
