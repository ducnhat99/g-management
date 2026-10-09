'use client';

import { formatVND, type PriceDto } from '@gold/shared';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';
import { formatCountdown, formatDateTimeVN } from '@/lib/format';
import { useRefreshPrice } from '@/lib/queries';
import { useNow } from '@/lib/use-now';

function Banner({ tone, children }: { tone: 'warning' | 'error'; children: ReactNode }) {
  const styles = tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900';
  return (
    <p role="alert" className={`rounded-md px-3 py-2 text-sm ${styles}`}>
      {children}
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
        className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refresh.isPending && (
          <span
            aria-hidden="true"
            className="size-3.5 animate-spin rounded-full border-2 border-stone-400 border-t-transparent"
          />
        )}
        {refresh.isPending
          ? 'Đang làm mới…'
          : waiting
            ? `Làm mới sau ${formatCountdown(remaining)}`
            : 'Làm mới'}
      </button>
      {refresh.isError && !tooSoon && (
        <span className="text-xs text-red-700">Lỗi: {refresh.error.message}</span>
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
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Giá Ngọc Thịnh · Nhẫn trơn 9999</h2>
          <p className="text-xs text-stone-500">VNĐ/chỉ</p>
        </div>
        <RefreshButton nextRefreshAt={price?.nextRefreshAt ?? null} />
      </div>

      {price ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-stone-600">Mua vào</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatVND(price.buyPrice)}</dd>
              <dd className="text-xs text-stone-500">Dùng để tính lời/lỗ</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-600">Bán ra</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatVND(price.sellPrice)}</dd>
              <dd className="text-xs text-stone-500">Chênh lệch {formatVND(price.spread)}</dd>
            </div>
          </dl>
          <div className="mt-3 space-y-0.5 text-xs text-stone-600">
            <p>Ngọc Thịnh cập nhật lúc {formatDateTimeVN(price.sourceUpdatedAt)}</p>
            <p>Kiểm tra lúc {formatDateTimeVN(price.checkedAt)}</p>
          </div>
          <div className="mt-3 space-y-2 empty:hidden">
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
        </>
      ) : (
        <div className="mt-4">
          <Banner tone="error">
            Chưa lấy được giá Ngọc Thịnh{priceError ? ` (${priceError})` : ''}. Lời/lỗ sẽ hiện khi
            có giá.
          </Banner>
        </div>
      )}
    </section>
  );
}
