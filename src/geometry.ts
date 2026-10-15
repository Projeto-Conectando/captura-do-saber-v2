// Shared headline card geometry, so the drawn card and its hit box always match

// Normalized screen rectangle (0 to 1)
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CARD_WIDTH_VW = 0.44;
const CARD_MAX_WIDTH_PX = 620;
const CARD_ASPECT = 16 / 9;

// Card travels from the "horizon" (small, high) towards the player (big, centered)
export const cardScale = (progress: number) => 0.2 + 0.8 * progress * progress;
export const cardTopPct = (progress: number) => 28 + 22 * progress;

export function cardRect(progress: number, viewW: number, viewH: number): Rect {
  const w = Math.min(CARD_WIDTH_VW * viewW, CARD_MAX_WIDTH_PX) * cardScale(progress);
  const h = w / CARD_ASPECT;
  const cy = cardTopPct(progress) / 100;
  const halfW = w / 2 / viewW;
  const halfH = h / 2 / viewH;
  return { x0: 0.5 - halfW, y0: cy - halfH, x1: 0.5 + halfW, y1: cy + halfH };
}

// Grows a rect by a fraction of its own width (each side) and height (top / bottom)
export function expandRect(r: Rect, fx: number, fyTop: number, fyBottom = fyTop): Rect {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  return { x0: r.x0 - w * fx, y0: r.y0 - h * fyTop, x1: r.x1 + w * fx, y1: r.y1 + h * fyBottom };
}

export const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
