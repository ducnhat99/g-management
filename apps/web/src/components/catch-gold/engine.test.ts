import { describe, expect, it } from 'vitest';
import {
  BASKET,
  ITEM_RULES,
  START_LIVES,
  WORLD,
  createGame,
  difficulty,
  isCaught,
  pickKind,
  startGame,
  step,
  type FallingItem,
  type GameState,
  type ItemKind,
} from './engine';

/** A playing game with one item just above the basket, and nothing else due to spawn. */
function withItem(kind: ItemKind, x = WORLD.width / 2, overrides: Partial<GameState> = {}) {
  const item: FallingItem = { id: 99, kind, x, y: BASKET.y - ITEM_RULES[kind].radius, vy: 200 };
  return { ...startGame(), items: [item], spawnIn: 10, ...overrides };
}

const tick = (state: GameState, targetX: number | null = null) => step(state, 0.016, targetX);

describe('createGame / startGame', () => {
  it('starts waiting, then plays with 3 lives and no score', () => {
    expect(createGame().status).toBe('ready');
    expect(startGame()).toMatchObject({ status: 'playing', lives: START_LIVES, score: 0 });
  });

  it('does nothing until started', () => {
    const ready = createGame();
    expect(step(ready, 1, 0)).toBe(ready);
  });
});

describe('catching', () => {
  it('a 9999 ring adds 1 chỉ', () => {
    const next = tick(withItem('ring'));
    expect(next.score).toBe(1);
    expect(next.items).toHaveLength(0);
    expect(next.caught.ring).toBe(1);
    expect(next.popups[0]).toMatchObject({ text: '+1 chỉ', good: true });
  });

  it('a gold bar adds 1 cây (10 chỉ)', () => {
    expect(tick(withItem('bar')).score).toBe(10);
  });

  it('fake gold costs 2 chỉ but never goes below 0', () => {
    expect(tick(withItem('fake', undefined, { score: 5 })).score).toBe(3);
    expect(tick(withItem('fake', undefined, { score: 1 })).score).toBe(0);
  });

  it('a bomb costs a life, and the last life ends the game', () => {
    expect(tick(withItem('bomb')).lives).toBe(START_LIVES - 1);
    const over = tick(withItem('bomb', undefined, { lives: 1 }));
    expect(over).toMatchObject({ status: 'over', lives: 0 });
    // A finished game no longer moves.
    expect(tick(over)).toBe(over);
  });

  it('misses an item outside the basket, without penalty', () => {
    const far = withItem('ring', 20, { basketX: WORLD.width - BASKET.width / 2 });
    const next = tick(far);
    expect(next.score).toBe(0);
    expect(next.items).toHaveLength(1);
  });

  it('drops items that fell past the bottom', () => {
    const fallen = withItem('ring', 20, {
      items: [{ id: 1, kind: 'ring', x: 20, y: WORLD.height + 30, vy: 200 }],
    });
    expect(tick(fallen).items).toHaveLength(0);
  });

  it('isCaught checks the basket width', () => {
    const item: FallingItem = { id: 1, kind: 'ring', x: 100, y: BASKET.y, vy: 0 };
    expect(isCaught(item, 100)).toBe(true);
    expect(isCaught(item, 100 + BASKET.width)).toBe(false);
  });
});

describe('basket movement', () => {
  it('slides toward the target at a limited speed', () => {
    const start = startGame();
    const next = step({ ...start, spawnIn: 10 }, 0.016, 0);
    expect(next.basketX).toBeCloseTo(start.basketX - BASKET.maxSpeed * 0.016);
  });

  it('stays inside the screen', () => {
    let state: GameState = { ...startGame(), spawnIn: 10 };
    for (let i = 0; i < 100; i++) state = step({ ...state, spawnIn: 10 }, 0.05, -500);
    expect(state.basketX).toBe(BASKET.width / 2);
  });

  it('stays put without a target', () => {
    const start = { ...startGame(), spawnIn: 10 };
    expect(step(start, 0.016, null).basketX).toBe(start.basketX);
  });
});

describe('spawning and difficulty', () => {
  it('drops a new item from the top when the timer runs out', () => {
    const next = step({ ...startGame(), spawnIn: 0.01 }, 0.016, null, () => 0.5);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.y).toBeLessThan(0);
  });

  it('clamps long frames so items do not jump', () => {
    const next = step({ ...startGame(), spawnIn: 10 }, 5, null);
    expect(next.elapsed).toBeCloseTo(0.05);
  });

  it('gets faster and busier over time, then levels off', () => {
    expect(difficulty(60).fallSpeed).toBeGreaterThan(difficulty(0).fallSpeed);
    expect(difficulty(60).spawnEvery).toBeLessThan(difficulty(0).spawnEvery);
    expect(difficulty(500)).toEqual(difficulty(75));
  });

  it('picks rings most often and every kind sometimes', () => {
    const counts: Record<ItemKind, number> = { ring: 0, bar: 0, fake: 0, bomb: 0 };
    for (let i = 0; i < 1000; i++) counts[pickKind(i / 1000)] += 1;
    expect(counts.ring).toBeGreaterThan(counts.fake + counts.bomb + counts.bar);
    expect(Object.values(counts).every((n) => n > 0)).toBe(true);
  });
});
