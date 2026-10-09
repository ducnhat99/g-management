/** A price read from a source site. Prices are VND per chỉ. */
export interface PriceQuote {
  /** What the shop pays you (giá mua vào). */
  buyPrice: number;
  /** What the shop charges you (giá bán ra). */
  sellPrice: number;
  /** Time printed on the source site. */
  sourceUpdatedAt: Date;
}

/** A site we can read a quote from. Abstract so PricesService tests can mock the crawl. */
export abstract class PriceSource {
  abstract fetchQuote(): Promise<PriceQuote>;
}

/** Network failure, timeout, or a non-2xx HTTP response. */
export class PriceFetchError extends Error {
  override readonly name = 'PriceFetchError';
}

/** The page loaded but did not contain a valid, plausible quote. */
export class PriceParseError extends Error {
  override readonly name = 'PriceParseError';
}
