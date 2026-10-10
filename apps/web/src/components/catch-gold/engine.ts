// "Hứng vàng" game rules, with no DOM or canvas: a pure step(state, dt) function, so the game
// logic is unit-tested and the component only draws. Coordinates are in a fixed 360×560 world
// that the canvas scales to the screen.

export const WORLD = { width: 360, height: 560 } as const;

/** The basket. `y` is the top of its opening. */
export const BASKET = { width: 72, height: 30, y: WORLD.height - 52, maxSpeed: 900 } as const;

export const START_LIVES = 3;

export type ItemKind = 'ring' | 'bar' | 'fake' | 'bomb';

export const ITEM_RULES: Record<
  ItemKind,
  { radius: number; chi: number; weight: number; label: string }
> = {
  /** Nhẫn trơn 9999. */
  ring: { radius: 14, chi: 1, weight: 68, label: '+1 chỉ' },
  /** Thỏi vàng: rare, worth a whole cây. */
  bar: { radius: 17, chi: 10, weight: 6, label: '+1 cây' },
  /** Vàng giả: costs 2 chỉ. */
  fake: { radius: 14, chi: -2, weight: 15, label: '-2 chỉ' },
  /** Bom: costs a life. */
  bomb: { radius: 15, chi: 0, weight: 11, label: '-1 mạng' },
};

export interface FallingItem {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  /** Fall speed, world units per second. */
  vy: number;
}

/** A "+1 chỉ" style label floating up from where something was caught. */
export interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  good: boolean;
  /** Seconds left on screen. */
  ttl: number;
}

export interface GameState {
  status: 'ready' | 'playing' | 'over';
  /** Basket center. */
  basketX: number;
  items: FallingItem[];
  popups: Popup[];
  /** Score in chỉ (never below 0). */
  score: number;
  lives: number;
  /** Seconds played. */
  elapsed: number;
  /** Seconds until the next item drops. */
  spawnIn: number;
  nextId: number;
  caught: Record<ItemKind, number>;
}

export const POPUP_SECONDS = 0.8;
/** Frames longer than this (tab switch, slow phone) are clamped so items do not teleport. */
export const MAX_STEP_SECONDS = 0.05;

const noneCaught = (): Record<ItemKind, number> => ({ ring: 0, bar: 0, fake: 0, bomb: 0 });

export function createGame(): GameState {
  return {
    status: 'ready',
    basketX: WORLD.width / 2,
    items: [],
    popups: [],
    score: 0,
    lives: START_LIVES,
    elapsed: 0,
    spawnIn: 0.6,
    nextId: 1,
    caught: noneCaught(),
  };
}

export function startGame(): GameState {
  return { ...createGame(), status: 'playing' };
}

/** Items drop more often and faster the longer you survive; it levels off after ~75 s. */
export function difficulty(elapsed: number): { spawnEvery: number; fallSpeed: number } {
  const t = Math.min(elapsed / 75, 1);
  return { spawnEvery: 0.85 - 0.5 * t, fallSpeed: 150 + 230 * t };
}

export function pickKind(roll: number): ItemKind {
  const kinds = Object.keys(ITEM_RULES) as ItemKind[];
  const total = kinds.reduce((sum, kind) => sum + ITEM_RULES[kind].weight, 0);
  let left = roll * total;
  for (const kind of kinds) {
    left -= ITEM_RULES[kind].weight;
    if (left < 0) return kind;
  }
  return 'ring';
}

const clampBasket = (x: number) =>
  Math.min(WORLD.width - BASKET.width / 2, Math.max(BASKET.width / 2, x));

/** True when the item touches the basket opening. */
export function isCaught(item: FallingItem, basketX: number): boolean {
  const { radius } = ITEM_RULES[item.kind];
  const reachesOpening = item.y + radius >= BASKET.y && item.y - radius <= BASKET.y + BASKET.height;
  return reachesOpening && Math.abs(item.x - basketX) <= BASKET.width / 2 + radius * 0.4;
}

/**
 * Advances the game by `dt` seconds. `targetX` is where the player points (finger/mouse), or null
 * to stay put; the basket slides toward it at most `BASKET.maxSpeed`. `random` is injectable for
 * tests.
 */
export function step(
  state: GameState,
  dt: number,
  targetX: number | null,
  random: () => number = Math.random,
): GameState {
  if (state.status !== 'playing') return state;
  const seconds = Math.min(Math.max(dt, 0), MAX_STEP_SECONDS);

  let basketX = state.basketX;
  if (targetX !== null) {
    const move = clampBasket(targetX) - basketX;
    const maxMove = BASKET.maxSpeed * seconds;
    basketX += Math.max(-maxMove, Math.min(maxMove, move));
  }

  const elapsed = state.elapsed + seconds;
  const { spawnEvery, fallSpeed } = difficulty(elapsed);
  let { spawnIn, nextId } = state;
  const items = state.items.map((item) => ({ ...item, y: item.y + item.vy * seconds }));

  spawnIn -= seconds;
  while (spawnIn <= 0) {
    const kind = pickKind(random());
    const { radius } = ITEM_RULES[kind];
    items.push({
      id: nextId++,
      kind,
      x: radius + random() * (WORLD.width - 2 * radius),
      y: -radius,
      vy: fallSpeed * (0.85 + random() * 0.3),
    });
    spawnIn += spawnEvery;
  }

  let { score, lives } = state;
  const caught = { ...state.caught };
  const popups = state.popups
    .map((popup) => ({ ...popup, y: popup.y - 40 * seconds, ttl: popup.ttl - seconds }))
    .filter((popup) => popup.ttl > 0);

  const remaining: FallingItem[] = [];
  for (const item of items) {
    if (isCaught(item, basketX)) {
      const rule = ITEM_RULES[item.kind];
      caught[item.kind] += 1;
      if (item.kind === 'bomb') {
        lives -= 1;
      } else {
        score = Math.max(0, score + rule.chi);
      }
      popups.push({
        id: nextId++,
        x: item.x,
        y: BASKET.y - 8,
        text: rule.label,
        good: rule.chi > 0,
        ttl: POPUP_SECONDS,
      });
    } else if (item.y - ITEM_RULES[item.kind].radius <= WORLD.height) {
      remaining.push(item);
    }
    // Missed items fall off the bottom; there is no penalty for missing.
  }

  return {
    status: lives <= 0 ? 'over' : 'playing',
    basketX,
    items: remaining,
    popups,
    score,
    lives: Math.max(0, lives),
    elapsed,
    spawnIn,
    nextId,
    caught,
  };
}
