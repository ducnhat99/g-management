import type { ConfigService } from '@nestjs/config';

/** Timing rules for crawling. Built from env in PricesModule; tests construct it directly. */
export class PricesConfig {
  constructor(
    /** A successful crawl is reused for this long, on app open and for "Làm mới". */
    readonly ttlMs: number,
    /** After a failed crawl, wait this long before trying again. */
    readonly failureBackoffMs: number,
    /** A source time older than this marks the price as stale. */
    readonly staleAfterMs: number = 24 * 60 * 60 * 1000,
  ) {}

  static fromEnv(config: ConfigService): PricesConfig {
    return new PricesConfig(
      seconds(config, 'PRICE_TTL_SECONDS', 3600) * 1000,
      seconds(config, 'PRICE_FAILURE_BACKOFF_SECONDS', 60) * 1000,
    );
  }
}

function seconds(config: ConfigService, key: string, fallback: number): number {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive whole number of seconds, got "${raw}"`);
  }
  return value;
}
