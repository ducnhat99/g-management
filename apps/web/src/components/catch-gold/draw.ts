import {
  BASKET,
  ITEM_RULES,
  POPUP_SECONDS,
  WORLD,
  type FallingItem,
  type GameState,
} from './engine';

// Canvas drawing for "Hứng vàng". Shapes rather than emoji, so it looks the same on every phone.
// All coordinates are world units; the caller has already scaled the context.

const GOLD = '#d4a017';
const GOLD_LIGHT = '#fde68a';
const GOLD_DARK = '#a16207';

function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, '#fffbeb');
  sky.addColorStop(1, '#fde68a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  // Counter top under the basket.
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, WORLD.height - 18, WORLD.width, 18);
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fake: boolean) {
  ctx.lineWidth = 5;
  ctx.strokeStyle = fake ? '#9ca3af' : GOLD;
  ctx.beginPath();
  ctx.arc(x, y, r - 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = fake ? '#e5e7eb' : GOLD_LIGHT;
  ctx.beginPath();
  ctx.arc(x, y, r - 4, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  ctx.fillStyle = fake ? '#4b5563' : GOLD_DARK;
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fake ? 'giả' : '9999', x, y + 0.5);
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const w = r * 2.2;
  const h = r * 1.2;
  const shine = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
  shine.addColorStop(0, GOLD_LIGHT);
  shine.addColorStop(1, GOLD);
  ctx.fillStyle = shine;
  ctx.strokeStyle = GOLD_DARK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#713f12';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1 CÂY', x, y + 0.5);
}

function drawBomb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(x, y + 2, r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, y - r + 4);
  ctx.quadraticCurveTo(x + 8, y - r - 2, x + 12, y - r);
  ctx.stroke();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(x + 12, y - r, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawItem(ctx: CanvasRenderingContext2D, item: FallingItem) {
  const { radius } = ITEM_RULES[item.kind];
  if (item.kind === 'bar') drawBar(ctx, item.x, item.y, radius);
  else if (item.kind === 'bomb') drawBomb(ctx, item.x, item.y, radius);
  else drawRing(ctx, item.x, item.y, radius, item.kind === 'fake');
}

function drawBasket(ctx: CanvasRenderingContext2D, x: number) {
  const top = BASKET.y;
  const half = BASKET.width / 2;
  ctx.fillStyle = '#b45309';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - half, top);
  ctx.lineTo(x + half, top);
  ctx.lineTo(x + half - 10, top + BASKET.height);
  ctx.lineTo(x - half + 10, top + BASKET.height);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Weave lines.
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const y = top + (BASKET.height / 3) * i;
    ctx.beginPath();
    ctx.moveTo(x - half + 4 + i * 3, y);
    ctx.lineTo(x + half - 4 - i * 3, y);
    ctx.stroke();
  }
  // Rim.
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x - half - 3, top - 4, BASKET.width + 6, 5);
}

function drawPopups(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const popup of state.popups) {
    ctx.globalAlpha = Math.max(0, popup.ttl / POPUP_SECONDS);
    ctx.fillStyle = popup.good ? '#047857' : '#b91c1c';
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.globalAlpha = 1;
}

/** Draws one frame. `scale` maps world units to canvas pixels (CSS width / 360 × devicePixelRatio). */
export function drawFrame(ctx: CanvasRenderingContext2D, state: GameState, scale: number) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawBackground(ctx);
  for (const item of state.items) drawItem(ctx, item);
  drawBasket(ctx, state.basketX);
  drawPopups(ctx, state);
}
