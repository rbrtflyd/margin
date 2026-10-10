import type { Item } from './types';
import {
  boundsOf,
  hasRect,
  itemKind,
  unionRect,
  type Rect,
} from './items';
import { isAttach } from './connectors';
import { shiftItem } from './clipboard';

export const GRID = 24;
export const GUIDE_PX = 6;

export type AlignEdge =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';
export type ArrangeOp = AlignEdge | 'distribute-h' | 'distribute-v' | 'tidy';

export type Guides = {
  v: number[];
  h: number[];
  ticks: Rect[];
};

export function snapGrid(n: number, pitch = GRID): number {
  return Math.round(n / pitch) * pitch;
}

function median(ns: number[]): number {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function connectorBounds(i: Item): Rect | null {
  const pts: { x: number; y: number }[] = [];
  if (i.start && !isAttach(i.start)) pts.push(i.start);
  if (i.end && !isAttach(i.end)) pts.push(i.end);
  if (!pts.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

function deltaFor(b: Rect, target: Rect, edge: AlignEdge): { dx: number; dy: number } {
  switch (edge) {
    case 'left':
      return { dx: target.x - b.x, dy: 0 };
    case 'center':
      return { dx: target.x + target.w / 2 - (b.x + b.w / 2), dy: 0 };
    case 'right':
      return { dx: target.x + target.w - (b.x + b.w), dy: 0 };
    case 'top':
      return { dx: 0, dy: target.y - b.y };
    case 'middle':
      return { dx: 0, dy: target.y + target.h / 2 - (b.y + b.h / 2) };
    case 'bottom':
      return { dx: 0, dy: target.y + target.h - (b.y + b.h) };
  }
}

function applyDelta(i: Item, dx: number, dy: number): Item {
  if (!dx && !dy) return i;
  return shiftItem(i, dx, dy);
}

export function alignItems(
  items: Item[],
  ids: Iterable<string>,
  edge: AlignEdge,
): Item[] {
  const set = ids instanceof Set ? ids : new Set(ids);
  const boxes = items.filter((i) => set.has(i.id) && hasRect(i));
  const target = unionRect(boxes.map(boundsOf));
  if (!target || boxes.length < 2) return items;
  return items.map((i) => {
    if (!set.has(i.id)) return i;
    if (hasRect(i)) {
      const { dx, dy } = deltaFor(boundsOf(i), target, edge);
      return applyDelta(i, dx, dy);
    }
    if (itemKind(i) === 'connector') {
      const b = connectorBounds(i);
      if (!b) return i;
      const { dx, dy } = deltaFor(b, target, edge);
      return applyDelta(i, dx, dy);
    }
    return i;
  });
}

export function distributeItems(
  items: Item[],
  ids: Iterable<string>,
  axis: DistributeAxis,
): Item[] {
  const set = ids instanceof Set ? ids : new Set(ids);
  const boxes = items.filter((i) => set.has(i.id) && hasRect(i));
  if (boxes.length < 3) return items;
  const sorted = [...boxes].sort((a, b) => {
    const ra = boundsOf(a);
    const rb = boundsOf(b);
    return axis === 'horizontal' ? ra.x - rb.x : ra.y - rb.y;
  });
  const first = boundsOf(sorted[0]);
  const last = boundsOf(sorted[sorted.length - 1]);
  const total = sorted.reduce(
    (n, i) => n + (axis === 'horizontal' ? boundsOf(i).w : boundsOf(i).h),
    0,
  );
  const span =
    axis === 'horizontal'
      ? last.x + last.w - first.x
      : last.y + last.h - first.y;
  const gap = (span - total) / (sorted.length - 1);
  const dxFor = new Map<string, { dx: number; dy: number }>();
  let cursor = axis === 'horizontal' ? first.x : first.y;
  for (const i of sorted) {
    const b = boundsOf(i);
    if (axis === 'horizontal') {
      dxFor.set(i.id, { dx: cursor - b.x, dy: 0 });
      cursor += b.w + gap;
    } else {
      dxFor.set(i.id, { dx: 0, dy: cursor - b.y });
      cursor += b.h + gap;
    }
  }
  return items.map((i) => {
    const d = dxFor.get(i.id);
    if (d) return applyDelta(i, d.dx, d.dy);
    if (set.has(i.id) && itemKind(i) === 'connector') {
      const b = connectorBounds(i);
      if (!b) return i;
      // Keep attached ends; shift free ends with the first box's delta as a fallback.
      const any = dxFor.values().next().value as
        | { dx: number; dy: number }
        | undefined;
      return any ? applyDelta(i, any.dx, any.dy) : i;
    }
    return i;
  });
}

export function tidyItems(items: Item[], ids: Iterable<string>): Item[] {
  const set = ids instanceof Set ? ids : new Set(ids);
  const boxes = items.filter((i) => set.has(i.id) && hasRect(i));
  if (boxes.length < 2) return items;
  const rects = boxes.map(boundsOf);
  const u = unionRect(rects);
  if (!u) return items;
  const medW = median(rects.map((r) => r.w)) || 160;
  const medH = median(rects.map((r) => r.h)) || 40;
  const gaps: number[] = [];
  const byX = [...rects].sort((a, b) => a.x - b.x);
  for (let i = 1; i < byX.length; i++) {
    gaps.push(byX[i].x - (byX[i - 1].x + byX[i - 1].w));
  }
  const gap = Math.max(8, median(gaps.filter((g) => g > 0)) || 16);
  const cols = Math.max(1, Math.round(u.w / (medW + gap)) || 1);
  const sorted = [...boxes].sort((a, b) => {
    const ra = boundsOf(a);
    const rb = boundsOf(b);
    return ra.y - rb.y || ra.x - rb.x;
  });
  const dxFor = new Map<string, { dx: number; dy: number }>();
  sorted.forEach((i, n) => {
    const b = boundsOf(i);
    const col = n % cols;
    const row = Math.floor(n / cols);
    dxFor.set(i.id, {
      dx: u.x + col * (medW + gap) - b.x,
      dy: u.y + row * (medH + gap) - b.y,
    });
  });
  return items.map((i) => {
    const d = dxFor.get(i.id);
    return d ? applyDelta(i, d.dx, d.dy) : i;
  });
}

export function arrangeItems(
  items: Item[],
  ids: Iterable<string>,
  op: ArrangeOp,
): Item[] {
  if (op === 'distribute-h') return distributeItems(items, ids, 'horizontal');
  if (op === 'distribute-v') return distributeItems(items, ids, 'vertical');
  if (op === 'tidy') return tidyItems(items, ids);
  return alignItems(items, ids, op);
}

function pickSnap(
  candidates: { delta: number; at: number; tick?: Rect }[],
  thresh: number,
): { delta: number; at: number; tick?: Rect } | null {
  let best: { delta: number; at: number; tick?: Rect } | null = null;
  for (const c of candidates) {
    if (Math.abs(c.delta) > thresh) continue;
    if (!best || Math.abs(c.delta) < Math.abs(best.delta)) best = c;
  }
  return best;
}

function edgeSnapsX(moving: Rect, others: Rect[]): { delta: number; at: number }[] {
  const mx = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const out: { delta: number; at: number }[] = [];
  for (const o of others) {
    const ox = [o.x, o.x + o.w / 2, o.x + o.w];
    for (const a of mx) {
      for (const b of ox) {
        out.push({ delta: b - a, at: b });
      }
    }
  }
  return out;
}

function edgeSnapsY(moving: Rect, others: Rect[]): { delta: number; at: number }[] {
  const my = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  const out: { delta: number; at: number }[] = [];
  for (const o of others) {
    const oy = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const a of my) {
      for (const b of oy) {
        out.push({ delta: b - a, at: b });
      }
    }
  }
  return out;
}

function spacingSnapsX(
  moving: Rect,
  others: Rect[],
): { delta: number; at: number; tick: Rect }[] {
  const out: { delta: number; at: number; tick: Rect }[] = [];
  for (const a of others) {
    for (const b of others) {
      if (a === b) continue;
      const gap = a.x - (b.x + b.w);
      if (gap <= 0) continue;
      // M to the right of A, matching B→A gap
      const want = a.x + a.w + gap;
      out.push({
        delta: want - moving.x,
        at: a.x + a.w,
        tick: { x: a.x + a.w, y: a.y + a.h / 2, w: gap, h: 0 },
      });
      // M to the left of B, matching B→A gap (A is right of B here)
      const wantL = b.x - gap - moving.w;
      out.push({
        delta: wantL - moving.x,
        at: b.x,
        tick: { x: b.x - gap, y: b.y + b.h / 2, w: gap, h: 0 },
      });
    }
  }
  return out;
}

function spacingSnapsY(
  moving: Rect,
  others: Rect[],
): { delta: number; at: number; tick: Rect }[] {
  const out: { delta: number; at: number; tick: Rect }[] = [];
  for (const a of others) {
    for (const b of others) {
      if (a === b) continue;
      const gap = a.y - (b.y + b.h);
      if (gap <= 0) continue;
      const want = a.y + a.h + gap;
      out.push({
        delta: want - moving.y,
        at: a.y + a.h,
        tick: { x: a.x + a.w / 2, y: a.y + a.h, w: 0, h: gap },
      });
      const wantL = b.y - gap - moving.h;
      out.push({
        delta: wantL - moving.y,
        at: b.y,
        tick: { x: b.x + b.w / 2, y: b.y - gap, w: 0, h: gap },
      });
    }
  }
  return out;
}

/** Snap a live rect to other rects. Returns extra dx/dy to apply and guides. */
export function snapRect(
  moving: Rect,
  others: Rect[],
  thresh: number,
  grid: boolean,
): { dx: number; dy: number; guides: Guides } {
  const guides: Guides = { v: [], h: [], ticks: [] };
  let dx = 0;
  let dy = 0;
  const xSmart = pickSnap(
    [...edgeSnapsX(moving, others), ...spacingSnapsX(moving, others)],
    thresh,
  );
  const ySmart = pickSnap(
    [...edgeSnapsY(moving, others), ...spacingSnapsY(moving, others)],
    thresh,
  );
  if (xSmart) {
    dx = xSmart.delta;
    guides.v.push(xSmart.at);
    if (xSmart.tick) guides.ticks.push(xSmart.tick);
  } else if (grid) {
    dx = snapGrid(moving.x) - moving.x;
  }
  if (ySmart) {
    dy = ySmart.delta;
    guides.h.push(ySmart.at);
    if (ySmart.tick) guides.ticks.push(ySmart.tick);
  } else if (grid) {
    dy = snapGrid(moving.y) - moving.y;
  }
  return { dx, dy, guides };
}

export function snapDragDelta(
  orig: Rect,
  others: Rect[],
  dx: number,
  dy: number,
  thresh: number,
  grid: boolean,
  disable: boolean,
): { dx: number; dy: number; guides: Guides | null } {
  if (disable) return { dx, dy, guides: null };
  const live = { ...orig, x: orig.x + dx, y: orig.y + dy };
  const s = snapRect(live, others, thresh, grid);
  return {
    dx: dx + s.dx,
    dy: dy + s.dy,
    guides: s.guides.v.length || s.guides.h.length || s.guides.ticks.length
      ? s.guides
      : null,
  };
}

export function snapResizeRect(
  box: Rect,
  others: Rect[],
  thresh: number,
  grid: boolean,
): { box: Rect; guides: Guides } {
  const { dx, dy, guides } = snapRect(box, others, thresh, false);
  let { x, y, w, h } = box;
  x += dx;
  y += dy;
  if (grid) {
    const x2 = snapGrid(x + w);
    const y2 = snapGrid(y + h);
    x = snapGrid(x);
    y = snapGrid(y);
    w = Math.max(1, x2 - x);
    h = Math.max(1, y2 - y);
  }
  return { box: { x, y, w, h }, guides };
}
