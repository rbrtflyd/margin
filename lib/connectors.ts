import type { Anchor, Item, Route, Side } from './types';
import { isBox, storedRect, type Rect } from './items';

export type Pt = { x: number; y: number };

export const SNAP = 28;
export const STUB = 16;
export const QUICK_GAP = 80;
export const PLUS_OUT = 22;
export const SIDES: Side[] = ['n', 'e', 's', 'w'];

export function oppositeSide(side: Side): Side {
  if (side === 'n') return 's';
  if (side === 's') return 'n';
  if (side === 'e') return 'w';
  return 'e';
}

/** Top-left of a same-size sibling placed `gap` beyond `side`. */
export function quickCreateOrigin(
  from: Rect,
  side: Side,
  size: { w: number; h: number },
  gap = QUICK_GAP,
): Pt {
  switch (side) {
    case 'e':
      return {
        x: from.x + from.w + gap,
        y: from.y + from.h / 2 - size.h / 2,
      };
    case 'w':
      return {
        x: from.x - gap - size.w,
        y: from.y + from.h / 2 - size.h / 2,
      };
    case 's':
      return {
        x: from.x + from.w / 2 - size.w / 2,
        y: from.y + from.h + gap,
      };
    case 'n':
      return {
        x: from.x + from.w / 2 - size.w / 2,
        y: from.y - gap - size.h,
      };
  }
}

export function isAttach(
  a: Anchor,
): a is { itemId: string; side: Side | 'auto' } {
  return 'itemId' in a;
}

export function sidePoint(rect: Rect, side: Side): Pt {
  switch (side) {
    case 'n':
      return { x: rect.x + rect.w / 2, y: rect.y };
    case 'e':
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
    case 's':
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case 'w':
      return { x: rect.x, y: rect.y + rect.h / 2 };
  }
}

export function nearestSide(rect: Rect, p: Pt): Side {
  const dn = Math.abs(p.y - rect.y);
  const ds = Math.abs(p.y - (rect.y + rect.h));
  const dw = Math.abs(p.x - rect.x);
  const de = Math.abs(p.x - (rect.x + rect.w));
  const m = Math.min(dn, ds, dw, de);
  if (m === dn) return 'n';
  if (m === ds) return 's';
  if (m === dw) return 'w';
  return 'e';
}

export function outPoint(p: Pt, side: Side, d: number): Pt {
  switch (side) {
    case 'n':
      return { x: p.x, y: p.y - d };
    case 's':
      return { x: p.x, y: p.y + d };
    case 'w':
      return { x: p.x - d, y: p.y };
    case 'e':
      return { x: p.x + d, y: p.y };
  }
}

export function resolveAnchor(
  anchor: Anchor | undefined,
  rects: Map<string, Rect>,
  fallback: Pt,
): { p: Pt; side: Side | null } {
  if (!anchor) return { p: fallback, side: null };
  if (isAttach(anchor)) {
    const r = rects.get(anchor.itemId);
    if (!r) return { p: fallback, side: null };
    const side = anchor.side === 'auto' ? nearestSide(r, fallback) : anchor.side;
    return { p: sidePoint(r, side), side };
  }
  return { p: { x: anchor.x, y: anchor.y }, side: null };
}

export function snapAnchor(
  p: Pt,
  rects: Map<string, Rect>,
  snap = SNAP,
  excludeId?: string,
): Anchor {
  let best: { score: number; itemId: string; side: Side } | null = null;
  for (const [id, r] of rects) {
    if (id === excludeId) continue;
    const inside =
      p.x >= r.x - snap &&
      p.x <= r.x + r.w + snap &&
      p.y >= r.y - snap &&
      p.y <= r.y + r.h + snap;
    if (!inside) continue;
    const side = nearestSide(r, p);
    const q = sidePoint(r, side);
    const dist = Math.hypot(p.x - q.x, p.y - q.y);
    if (!best || dist < best.score) best = { score: dist, itemId: id, side };
  }
  return best
    ? { itemId: best.itemId, side: best.side }
    : { x: Math.round(p.x), y: Math.round(p.y) };
}

function isH(side: Side | null) {
  return side === 'e' || side === 'w';
}

export function elbowPoints(
  a: Pt,
  aSide: Side | null,
  b: Pt,
  bSide: Side | null,
): Pt[] {
  const sa = aSide ? outPoint(a, aSide, STUB) : a;
  const sb = bSide ? outPoint(b, bSide, STUB) : b;
  const start = aSide ? [a, sa] : [a];
  const end = bSide ? [sb, b] : [b];
  if (isH(aSide) && isH(bSide)) {
    const midX = (sa.x + sb.x) / 2;
    return [
      ...start,
      { x: midX, y: sa.y },
      { x: midX, y: sb.y },
      ...end,
    ];
  }
  if (!isH(aSide) && aSide && !isH(bSide) && bSide) {
    const midY = (sa.y + sb.y) / 2;
    return [
      ...start,
      { x: sa.x, y: midY },
      { x: sb.x, y: midY },
      ...end,
    ];
  }
  if (isH(aSide) || (!aSide && isH(bSide))) {
    return [...start, { x: sb.x, y: sa.y }, ...end];
  }
  return [...start, { x: sa.x, y: sb.y }, ...end];
}

export function connectorPoints(
  start: { p: Pt; side: Side | null },
  end: { p: Pt; side: Side | null },
  route: Route,
): Pt[] {
  if (route === 'straight') return [start.p, end.p];
  return elbowPoints(start.p, start.side, end.p, end.side);
}

export function pathD(pts: Pt[]): string {
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
    .join(' ');
}

export function arrowHead(from: Pt, to: Pt, size = 8): string {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const p1 = {
    x: to.x - size * Math.cos(ang - Math.PI / 6),
    y: to.y - size * Math.sin(ang - Math.PI / 6),
  };
  const p2 = {
    x: to.x - size * Math.cos(ang + Math.PI / 6),
    y: to.y - size * Math.sin(ang + Math.PI / 6),
  };
  return `M${p1.x} ${p1.y} L${to.x} ${to.y} L${p2.x} ${p2.y}`;
}

export function alongPath(pts: Pt[], t = 0.5): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lens.push(len);
    total += len;
  }
  if (total === 0) return pts[0];
  let d = total * t;
  for (let i = 1; i < pts.length; i++) {
    const len = lens[i - 1];
    if (d <= len) {
      const u = len ? d / len : 0;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u,
      };
    }
    d -= len;
  }
  return pts[pts.length - 1];
}

export function detachAnchor(
  anchor: Anchor | undefined,
  gone: Set<string>,
  rects: Map<string, Rect>,
): Anchor | undefined {
  if (!anchor || !isAttach(anchor) || !gone.has(anchor.itemId)) return anchor;
  const r = rects.get(anchor.itemId);
  if (!r) return { x: 0, y: 0 };
  const side = anchor.side === 'auto' ? nearestSide(r, { x: r.x + r.w / 2, y: r.y + r.h / 2 }) : anchor.side;
  const p = sidePoint(r, side);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

export function nodeRects(items: Item[]): Map<string, Rect> {
  const m = new Map<string, Rect>();
  for (const it of items) {
    if (!isBox(it)) continue;
    m.set(it.id, storedRect(it));
  }
  return m;
}
