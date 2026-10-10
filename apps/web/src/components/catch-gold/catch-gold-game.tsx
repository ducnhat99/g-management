'use client';

import { formatChi } from '@gold/shared';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AppLogo } from '@/components/app-logo';
import { PlayIcon } from '@/components/icons';
import { readBestScore, saveBestScore } from './best-score';
import { drawFrame } from './draw';
import { START_LIVES, WORLD, createGame, startGame, step, type GameState } from './engine';

interface Hud {
  status: GameState['status'];
  score: number;
  lives: number;
}

const KEY_STEP = 60;

const pillClass =
  'inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1 shadow-sm';

const LEGEND = [
  { swatch: 'border-4 border-amber-500 rounded-full', text: 'Nhẫn 9999: +1 chỉ' },
  { swatch: 'bg-amber-400 rounded-sm', text: 'Thỏi vàng: +1 cây' },
  { swatch: 'border-4 border-gray-400 rounded-full', text: 'Vàng giả: −2 chỉ' },
  { swatch: 'bg-stone-900 rounded-full', text: 'Bom: −1 mạng' },
];

/**
 * "Hứng vàng": catch falling gold rings in a basket. Pure client code (no API calls), shown while
 * the API wakes up. `onExit`, when given, adds a button to leave from the game-over screen.
 */
export function CatchGoldGame({
  onExit,
  exitLabel = 'Xem danh mục',
}: {
  onExit?: () => void;
  exitLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(createGame());
  const targetRef = useRef<number | null>(null);
  const keysRef = useRef({ left: false, right: false });
  const [hud, setHud] = useState<Hud>({ status: 'ready', score: 0, lives: START_LIVES });
  const [best, setBest] = useState(readBestScore);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !container || !ctx) return;

    let scale = 1;
    const resize = () => {
      const width = container.clientWidth;
      const height = (width * WORLD.height) / WORLD.width;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
      scale = (width / WORLD.width) * dpr;
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(container);

    const onKey = (event: KeyboardEvent) => {
      const down = event.type === 'keydown';
      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') keysRef.current.left = down;
      else if (key === 'arrowright' || key === 'd') keysRef.current.right = down;
      else return;
      if (gameRef.current.status === 'playing') event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const game = gameRef.current;
      const keys = keysRef.current;
      const target =
        keys.left !== keys.right
          ? game.basketX + (keys.left ? -KEY_STEP : KEY_STEP)
          : targetRef.current;
      const next = step(game, dt, target);
      gameRef.current = next;
      drawFrame(ctx, next, scale);

      if (game.status === 'playing' && next.status === 'over') {
        setBest(saveBestScore(next.score));
      }
      setHud((prev) =>
        prev.status === next.status && prev.score === next.score && prev.lives === next.lives
          ? prev
          : { status: next.status, score: next.score, lives: next.lives },
      );
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  function start() {
    gameRef.current = startGame();
    targetRef.current = null;
    setHud({ status: 'playing', score: 0, lives: START_LIVES });
  }

  function aim(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    targetRef.current = ((event.clientX - rect.left) / rect.width) * WORLD.width;
  }

  return (
    <div className="mx-auto w-full max-w-sm select-none">
      <div className="mb-2.5 flex items-center justify-between gap-2 text-sm tabular-nums">
        <span className={pillClass}>
          Điểm: <strong className="text-amber-700">{formatChi(hud.score)}</strong>
        </span>
        <span aria-label={`Còn ${hud.lives} mạng`} className={`${pillClass} tracking-widest`}>
          <span className="text-red-500">{'♥'.repeat(hud.lives)}</span>
          <span className="text-stone-300">{'♥'.repeat(START_LIVES - hud.lives)}</span>
        </span>
        <span className={`${pillClass} text-stone-600`}>Kỷ lục: {formatChi(best)}</span>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-amber-200 shadow-md shadow-amber-900/5"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={aim}
          onPointerMove={aim}
          aria-label="Trò chơi Hứng vàng: kéo hoặc dùng phím mũi tên để di chuyển giỏ"
          className="block w-full touch-none"
          style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
        />

        {hud.status !== 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-50/70 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-xs animate-modal-in rounded-2xl bg-white/95 p-5 text-center shadow-xl shadow-amber-900/10">
              {hud.status === 'ready' ? (
                <>
                  <AppLogo className="mx-auto size-12" />
                  <h3 className="mt-2 text-2xl font-bold text-amber-700">Hứng vàng</h3>
                  <p className="mt-1 text-sm text-stone-600">
                    Kéo giỏ để hứng vàng thật, tránh vàng giả và bom.
                  </p>
                  <ul className="mt-4 grid grid-cols-1 gap-1.5 text-left text-sm text-stone-700">
                    {LEGEND.map((item) => (
                      <li
                        key={item.text}
                        className="flex items-center gap-2.5 rounded-lg bg-stone-50 px-3 py-1.5"
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-block size-4 shrink-0 ${item.swatch}`}
                        />
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium tracking-wide text-stone-500 uppercase">
                    Kết thúc
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-amber-700">Hết lượt!</h3>
                  <p className="mt-2 text-stone-700">
                    Bạn hứng được <strong className="text-amber-700">{formatChi(hud.score)}</strong>
                    {hud.score > 0 && hud.score >= best && (
                      <span className="mx-auto mt-2 block w-fit rounded-full bg-emerald-100 px-3 py-0.5 text-sm font-semibold text-emerald-700">
                        Kỷ lục mới!
                      </span>
                    )}
                  </p>
                </>
              )}
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-linear-to-r from-amber-500 to-amber-600 font-semibold text-white shadow-md shadow-amber-600/20 transition hover:from-amber-600 hover:to-amber-700"
                >
                  <PlayIcon className="size-4" />
                  {hud.status === 'ready' ? 'Bắt đầu' : 'Chơi lại'}
                </button>
                {hud.status === 'over' && onExit && (
                  <button
                    type="button"
                    onClick={onExit}
                    className="h-11 rounded-lg border border-stone-300 bg-white font-semibold text-stone-700 transition hover:bg-stone-50"
                  >
                    {exitLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
