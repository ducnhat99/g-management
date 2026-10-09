/** Current Ngọc Thịnh price as returned by GET /prices/latest and POST /prices/refresh. */
export interface PriceDto {
  /** Shop buy price (giá mua vào), VND per chỉ. Used for profit/loss. */
  buyPrice: number;
  /** Shop sell price (giá bán ra), VND per chỉ. */
  sellPrice: number;
  /** sellPrice - buyPrice. */
  spread: number;
  /** ISO time printed on the Ngọc Thịnh site ("Cập nhật lúc"). */
  sourceUpdatedAt: string;
  /** ISO time of the last successful crawl. */
  checkedAt: string;
  /** ISO time from which a new crawl (and the "Làm mới" button) is allowed. */
  nextRefreshAt: string;
  /** True when sourceUpdatedAt is more than 24 hours old. */
  isStale: boolean;
  /** Set when the latest crawl attempt failed and this is an older price. */
  refreshError: string | null;
}

/** One stored snapshot, as returned by GET /prices/history. */
export interface PriceHistoryItemDto {
  buyPrice: number;
  sellPrice: number;
  sourceUpdatedAt: string;
  checkedAt: string;
}

/** Body of the 429 returned by POST /prices/refresh before nextRefreshAt. */
export interface RefreshTooSoonDto {
  statusCode: 429;
  message: string;
  nextRefreshAt: string;
}
