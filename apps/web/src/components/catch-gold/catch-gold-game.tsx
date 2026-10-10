'use client';

import { formatChi } from '@gold/shared';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { readBestScore, saveBestScore } from './best-score';
import { drawFrame } from './draw';
import { START_LIVES, WORLD, createGame, startGame, step, type GameState } from './engine';

interface Hud {
  status: GameState['status'];
  score: number;
  lives: number;
}

const KEY_STEP = 60;

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
      <div className="mb-2 flex items-center justify-between text-sm tabular-nums">
        <span>
          Điểm: <strong>{formatChi(hud.score)}</strong>
        </span>
        <span aria-label={`Còn ${hud.lives} mạng`}>
          {'♥'.repeat(hud.lives)}
          <span className="text-stone-300">{'♥'.repeat(START_LIVES - hud.lives)}</span>
        </span>
        <span className="text-stone-600">Kỷ lục: {formatChi(best)}</span>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-amber-200 shadow-sm"
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-amber-50/90 p-6 text-center">
            {hud.status === 'ready' ? (
              <>
                <h3 className="text-2xl font-bold text-amber-800">Hứng vàng</h3>
                <p className="text-sm text-stone-700">
                  Kéo giỏ để hứng vàng thật, tránh vàng giả và bom.
                </p>
                <ul className="space-y-1.5 text-left text-sm">
                  {LEGEND.map((item) => (
                    <li key={item.text} className="flex items-center gap-2">
                      <span aria-hidden="true" className={`inline-block size-4 ${item.swatch}`} />
                      {item.text}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-amber-800">Hết lượt!</h3>
                <p className="text-stone-700">
                  Bạn hứng được <strong>{formatChi(hud.score)}</strong>
                  {hud.score > 0 && hud.score >= best && (
                    <span className="block text-sm font-medium text-emerald-700">Kỷ lục mới!</span>
                  )}
                </p>
              </>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={start}
                className="rounded-md bg-amber-600 px-5 py-2 font-medium text-white hover:bg-amber-700"
              >
                {hud.status === 'ready' ? 'Bắt đầu' : 'Chơi lại'}
              </button>
              {hud.status === 'over' && onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-md border border-stone-300 bg-white px-5 py-2 font-medium hover:bg-stone-100"
                >
                  {exitLabel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
