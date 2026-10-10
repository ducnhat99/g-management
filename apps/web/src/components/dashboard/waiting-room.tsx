'use client';

import { lazy, Suspense } from 'react';

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
    <section className="space-y-4">
      {ready ? (
        <div
          role="status"
          className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-md"
        >
          <span className="font-medium">✓ Dữ liệu đã sẵn sàng</span>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Xem danh mục
          </button>
        </div>
      ) : (
        <p role="status" className="flex items-center gap-2 text-sm text-stone-600">
          <span
            aria-hidden="true"
            className="size-3.5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"
          />
          Đang lấy giá vàng mới nhất… Chơi một ván Hứng vàng trong lúc chờ nhé!
        </p>
      )}
      <Suspense fallback={<p className="text-sm text-stone-500">Đang tải trò chơi…</p>}>
        <CatchGoldGame onExit={ready ? onContinue : undefined} />
      </Suspense>
    </section>
  );
}
