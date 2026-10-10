import type { View } from './types';
import type { Rect } from './items';

export type Pt = { x: number; y: number };

export function worldViewport(
  view: View,
  width: number,
  height: number,
  marginPx = 256,
): Rect {
  const m = marginPx / view.k;
  return {
    x: -view.x / view.k - m,
    y: -view.y / view.k - m,
    w: width / view.k + 2 * m,
    h: height / view.k + 2 * m,
  };
}

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function pointsBounds(pts: Pt[], pad: number): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: x0 - pad,
    y: y0 - pad,
    w: x1 - x0 + 2 * pad,
    h: y1 - y0 + 2 * pad,
  };
}
