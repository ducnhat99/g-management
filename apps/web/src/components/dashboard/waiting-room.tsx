'use client';

import { lazy, Suspense } from 'react';
import { GoldRingLogo } from '@/components/gold-ring-logo';

// Loaded only when the wait is actually slow, so fast visits never download the game.
const CatchGoldGame = lazy(() =>
  import('@/components/catch-gold/catch-gold-game').then((m) => ({ default: m.CatchGoldGame })),
);

/**
 * Shown instead of a spinner while the API wakes up (Render free plan). When the data is ready a
 * bar offers to continue; the player is never pulled out of a round.
 */
export function WaitingRoom({ ready, onContinue }: { ready: boolean; onContinue: () => void }) {
  return (
    <section className="mx-auto max-w-md space-y-4">
      {ready ? (
        // The text <span> and the button must stay siblings (the dashboard test relies on it).
        <div
          role="status"
          className="sticky top-16 z-10 flex animate-modal-in items-center justify-between gap-3 rounded-2xl bg-linear-to-r from-emerald-500 to-emerald-600 py-2.5 pr-2.5 pl-4 text-white shadow-lg shadow-emerald-700/20"
        >
          <span className="font-semibold">✓ Dữ liệu đã sẵn sàng</span>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
          >
            Xem danh mục
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-sm">
          <div className="flex items-center gap-3 p-4">
            <GoldRingLogo className="size-10 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="font-semibold text-stone-900">Đang chuẩn bị dữ liệu…</p>
              <p role="status" className="text-sm text-stone-600">
                Đang lấy giá vàng mới nhất… Chơi một ván Hứng vàng trong lúc chờ nhé!
              </p>
            </div>
          </div>
          {/* Indeterminate progress: the wait has no known length. */}
          <div aria-hidden="true" className="h-1 overflow-hidden bg-amber-100">
            <div className="h-full w-2/5 animate-progress rounded-full bg-linear-to-r from-amber-400 to-amber-600" />
          </div>
        </div>
      )}
      <Suspense
        fallback={
          <p className="rounded-2xl border border-dashed border-amber-200 p-8 text-center text-sm text-stone-500">
            Đang tải trò chơi…
          </p>
        }
      >
        <CatchGoldGame onExit={ready ? onContinue : undefined} />
      </Suspense>
    </section>
  );
}
