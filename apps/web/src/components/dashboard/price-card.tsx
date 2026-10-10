'use client';

import { formatVND, type PriceDto } from '@gold/shared';
import type { ReactNode } from 'react';
import { AlertIcon, ClockIcon, RefreshIcon } from '@/components/icons';
import { ApiError } from '@/lib/api-client';
import { formatCountdown, formatDateTimeVN } from '@/lib/format';
import { useRefreshPrice } from '@/lib/queries';
import { useNow } from '@/lib/use-now';

/** White notice on the gold card. */
function Banner({ tone, children }: { tone: 'warning' | 'error'; children: ReactNode }) {
  const styles = tone === 'error' ? 'text-red-800' : 'text-amber-900';
  return (
    <p
      role="alert"
      className={`flex items-start gap-2 rounded-lg bg-white/95 px-3 py-2 text-sm shadow-sm ${styles}`}
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** "Làm mới" stays disabled until nextRefreshAt (1 hour after the last crawl), with a countdown. */
function RefreshButton({ nextRefreshAt }: { nextRefreshAt: string | null }) {
  const refresh = useRefreshPrice();
  const target = nextRefreshAt ? Date.parse(nextRefreshAt) : 0;
  const now = useNow(1000, target > 0);
  const remaining = target - now;
  const waiting = remaining > 0;
  const tooSoon = refresh.error instanceof ApiError && refresh.error.status === 429;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => refresh.mutate()}
        disabled={waiting || refresh.isPending}
        title={waiting ? 'Giá đã được kiểm tra trong vòng 1 giờ' : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/40 backdrop-blur transition ring-inset hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:bg-white/15"
      >
        <RefreshIcon className={`size-4 ${refresh.isPending ? 'animate-spin' : ''}`} />
        <span className="tabular-nums">
          {refresh.isPending
            ? 'Đang làm mới…'
            : waiting
              ? `Làm mới sau ${formatCountdown(remaining)}`
              : 'Làm mới'}
        </span>
      </button>
      {refresh.isError && !tooSoon && (
        <span className="rounded bg-red-700/80 px-2 py-0.5 text-xs text-white">
          Lỗi: {refresh.error.message}
        </span>
      )}
    </div>
  );
}

export function PriceCard({
  price,
  priceError,
}: {
  price: PriceDto | null;
  priceError: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-amber-600 via-amber-500 to-yellow-400 p-5 text-white shadow-lg shadow-amber-900/10 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full border-36 border-white/10"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-amber-50/90">Giá Ngọc Thịnh · VNĐ/chỉ</p>
          <h2 className="text-lg font-semibold">Nhẫn trơn 9999</h2>
        </div>
        <RefreshButton nextRefreshAt={price?.nextRefreshAt ?? null} />
      </div>

      {price ? (
        <>
          <dl className="relative mt-5 grid grid-cols-2 gap-4 sm:gap-6">
            <div>
              <dt className="text-sm text-amber-50/90">Mua vào</dt>
              <dd className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                {formatVND(price.buyPrice)}
              </dd>
              <dd className="mt-0.5 text-xs text-amber-50/80">Dùng để tính lời/lỗ</dd>
            </div>
            <div className="border-l border-white/25 pl-4 sm:pl-6">
              <dt className="text-sm text-amber-50/90">Bán ra</dt>
              <dd className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                {formatVND(price.sellPrice)}
              </dd>
              <dd className="mt-0.5 text-xs text-amber-50/80">
                Chênh lệch {formatVND(price.spread)}
              </dd>
            </div>
          </dl>
          <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-50/90">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              <span>Ngọc Thịnh cập nhật lúc {formatDateTimeVN(price.sourceUpdatedAt)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshIcon className="size-3.5" />
              <span>Kiểm tra lúc {formatDateTimeVN(price.checkedAt)}</span>
            </span>
          </div>
          {(price.refreshError || price.isStale) && (
            <div className="relative mt-4 space-y-2">
              {price.refreshError && (
                <Banner tone="error">
                  Không lấy được giá mới, đang dùng giá lúc {formatDateTimeVN(price.checkedAt)}.
                </Banner>
              )}
              {price.isStale && (
                <Banner tone="warning">
                  Giá trên web Ngọc Thịnh đã hơn 24 giờ chưa cập nhật; giá thực tế tại tiệm có thể
                  khác.
                </Banner>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="relative mt-4">
          <Banner tone="error">
            Chưa lấy được giá Ngọc Thịnh{priceError ? ` (${priceError})` : ''}. Lời/lỗ sẽ hiện khi
            có giá.
          </Banner>
        </div>
      )}
    </section>
  );
}
