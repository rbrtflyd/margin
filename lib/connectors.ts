import type { Anchor, Arrowhead, AskEdge, Item, Route, Side } from './types';
import { isBox, itemKind, storedRect, type Rect } from './items';

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
  asAuto = false,
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
    ? { itemId: best.itemId, side: asAuto ? 'auto' : best.side }
    : { x: Math.round(p.x), y: Math.round(p.y) };
}

function centerOf(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function hintOf(anchor: Anchor | undefined, rects: Map<string, Rect>, fallback: Pt): Pt {
  if (!anchor) return fallback;
  if (isAttach(anchor)) {
    const r = rects.get(anchor.itemId);
    return r ? centerOf(r) : fallback;
  }
  return { x: anchor.x, y: anchor.y };
}

export function facingSide(rect: Rect, p: Pt): Side {
  const c = centerOf(rect);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'e' : 'w';
  return dy > 0 ? 's' : 'n';
}

function resolveOne(
  anchor: Anchor | undefined,
  toward: Pt,
  rects: Map<string, Rect>,
  fallback: Pt,
): { p: Pt; side: Side | null } {
  if (!anchor) return { p: fallback, side: null };
  if (isAttach(anchor)) {
    const r = rects.get(anchor.itemId);
    if (!r) return { p: fallback, side: null };
    const side = anchor.side === 'auto' ? facingSide(r, toward) : anchor.side;
    return { p: sidePoint(r, side), side };
  }
  return { p: { x: anchor.x, y: anchor.y }, side: null };
}

/** Resolve both ends so `side: 'auto'` aims at the other endpoint. */
export function resolveEnds(
  startA: Anchor | undefined,
  endA: Anchor | undefined,
  rects: Map<string, Rect>,
  fallback: Pt,
): { start: { p: Pt; side: Side | null }; end: { p: Pt; side: Side | null } } {
  const startHint = hintOf(endA, rects, fallback);
  let start = resolveOne(startA, startHint, rects, fallback);
  const end = resolveOne(endA, start.p, rects, fallback);
  start = resolveOne(startA, end.p, rects, fallback);
  return { start, end };
}

function isH(side: Side | null) {
  return side === 'e' || side === 'w';
}

export function elbowPoints(
  a: Pt,
  aSide: Side | null,
  b: Pt,
  bSide: Side | null,
  bend = 0,
): Pt[] {
  const sa = aSide ? outPoint(a, aSide, STUB) : a;
  const sb = bSide ? outPoint(b, bSide, STUB) : b;
  const start = aSide ? [a, sa] : [a];
  const end = bSide ? [sb, b] : [b];
  if (isH(aSide) && isH(bSide)) {
    const midX = (sa.x + sb.x) / 2 + bend;
    return [
      ...start,
      { x: midX, y: sa.y },
      { x: midX, y: sb.y },
      ...end,
    ];
  }
  if (!isH(aSide) && aSide && !isH(bSide) && bSide) {
    const midY = (sa.y + sb.y) / 2 + bend;
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

/** Middle segment of an opposing-side elbow, if any. */
export function elbowMid(
  pts: Pt[],
): { a: Pt; b: Pt; axis: 'x' | 'y' } | null {
  if (pts.length < 4) return null;
  let vert: { a: Pt; b: Pt; axis: 'x' | 'y' } | null = null;
  let horz: { a: Pt; b: Pt; axis: 'x' | 'y' } | null = null;
  for (let i = 1; i < pts.length - 2; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    if (p.x === q.x && Math.abs(p.y - q.y) > 1) {
      vert = { a: p, b: q, axis: 'x' };
    }
    if (p.y === q.y && Math.abs(p.x - q.x) > 1) {
      horz = { a: p, b: q, axis: 'y' };
    }
  }
  const stubH = pts[0].y === pts[1]?.y;
  if (stubH && vert) return vert;
  if (!stubH && horz) return horz;
  return vert ?? horz;
}

function cubic(a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

export function curvePoints(
  start: { p: Pt; side: Side | null },
  end: { p: Pt; side: Side | null },
): Pt[] {
  const sa = start.side ? outPoint(start.p, start.side, STUB) : start.p;
  const sb = end.side ? outPoint(end.p, end.side, STUB) : end.p;
  const d = Math.max(40, Math.hypot(sb.x - sa.x, sb.y - sa.y) / 2);
  const c1 = start.side ? outPoint(sa, start.side, d) : {
    x: sa.x + (sb.x - sa.x) / 3,
    y: sa.y + (sb.y - sa.y) / 3,
  };
  const c2 = end.side ? outPoint(sb, end.side, d) : {
    x: sb.x - (sb.x - sa.x) / 3,
    y: sb.y - (sb.y - sa.y) / 3,
  };
  const pts: Pt[] = [start.p];
  if (start.side) pts.push(sa);
  for (let i = 1; i <= 8; i++) pts.push(cubic(sa, c1, c2, sb, i / 8));
  if (end.side) pts.push(end.p);
  return pts;
}

export function connectorPoints(
  start: { p: Pt; side: Side | null },
  end: { p: Pt; side: Side | null },
  route: Route,
  bend = 0,
): Pt[] {
  if (route === 'straight') return [start.p, end.p];
  if (route === 'curved') return curvePoints(start, end);
  return elbowPoints(start.p, start.side, end.p, end.side, bend);
}

export function itemConnectorPoints(
  it: Item,
  rects: Map<string, Rect>,
): Pt[] {
  const ends = resolveEnds(it.start, it.end, rects, { x: it.x, y: it.y });
  return connectorPoints(
    ends.start,
    ends.end,
    it.route ?? 'straight',
    it.bend,
  );
}

export function arrowEndOf(it: Item): Arrowhead {
  return it.arrowEnd ?? 'arrow';
}

export function arrowStartOf(it: Item): Arrowhead {
  return it.arrowStart ?? 'none';
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

export function arrowTriangle(from: Pt, to: Pt, size = 9): string {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const p1 = {
    x: to.x - size * Math.cos(ang - Math.PI / 7),
    y: to.y - size * Math.sin(ang - Math.PI / 7),
  };
  const p2 = {
    x: to.x - size * Math.cos(ang + Math.PI / 7),
    y: to.y - size * Math.sin(ang + Math.PI / 7),
  };
  return `M${to.x} ${to.y} L${p1.x} ${p1.y} L${p2.x} ${p2.y} Z`;
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
  let d = total * Math.min(1, Math.max(0, t));
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

/** `t` in 0..1 of the closest point on the polyline to `p`. */
export function nearestT(pts: Pt[], p: Pt): number {
  if (pts.length < 2) return 0.5;
  let total = 0;
  const segs: { a: Pt; b: Pt; len: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push({ a: pts[i - 1], b: pts[i], len });
    total += len;
  }
  if (total === 0) return 0.5;
  let bestD = Infinity;
  let bestAlong = 0;
  let acc = 0;
  for (const s of segs) {
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const u = s.len
      ? ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / (s.len * s.len)
      : 0;
    const t = Math.min(1, Math.max(0, u));
    const q = { x: s.a.x + dx * t, y: s.a.y + dy * t };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bestD) {
      bestD = d;
      bestAlong = acc + t * s.len;
    }
    acc += s.len;
  }
  return bestAlong / total;
}

function inRect(p: Pt, r: Rect) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function hits(a: Pt, b: Pt, r: Rect): number[] {
  const ts: number[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const add = (t: number) => {
    if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
  };
  if (dx !== 0) {
    for (const x of [r.x, r.x + r.w]) {
      const t = (x - a.x) / dx;
      const y = a.y + t * dy;
      if (y >= r.y - 1e-6 && y <= r.y + r.h + 1e-6) add(t);
    }
  }
  if (dy !== 0) {
    for (const y of [r.y, r.y + r.h]) {
      const t = (y - a.y) / dy;
      const x = a.x + t * dx;
      if (x >= r.x - 1e-6 && x <= r.x + r.w + 1e-6) add(t);
    }
  }
  ts.sort((x, y) => x - y);
  const uniq: number[] = [];
  for (const t of ts) {
    if (!uniq.length || Math.abs(uniq[uniq.length - 1] - t) > 1e-6) uniq.push(t);
  }
  return uniq;
}

/** Visible stroke with a break around `gap`. Empty string if the gap covers the path. */
export function pathDGapped(pts: Pt[], gap: Rect | null): string {
  if (!gap || pts.length < 2) return pathD(pts);
  const parts: Pt[][] = [];
  let cur: Pt[] = [];
  const push = (p: Pt) => {
    const last = cur[cur.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) cur.push(p);
  };
  const flush = () => {
    if (cur.length >= 2) parts.push(cur);
    cur = [];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ts = [0, ...hits(a, b, gap), 1];
    for (let j = 0; j < ts.length - 1; j++) {
      const t0 = ts[j];
      const t1 = ts[j + 1];
      const mid = {
        x: a.x + ((b.x - a.x) * (t0 + t1)) / 2,
        y: a.y + ((b.y - a.y) * (t0 + t1)) / 2,
      };
      if (inRect(mid, gap)) {
        flush();
        continue;
      }
      const p0 = {
        x: a.x + (b.x - a.x) * t0,
        y: a.y + (b.y - a.y) * t0,
      };
      const p1 = {
        x: a.x + (b.x - a.x) * t1,
        y: a.y + (b.y - a.y) * t1,
      };
      const last = cur[cur.length - 1];
      if (last && (last.x !== p0.x || last.y !== p0.y)) flush();
      if (!cur.length) push(p0);
      push(p1);
    }
  }
  flush();
  if (!parts.length) return '';
  return parts.map(pathD).join(' ');
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

/** Boxes the assistant should read, without connector items. */
export function boxesForAsk(items: Item[]): Item[] {
  return items.filter((i) => itemKind(i) !== 'connector');
}

/** Connector endpoints as edges the assistant can quote. */
export function connectorEdges(items: Item[]): AskEdge[] {
  return items
    .filter((i) => itemKind(i) === 'connector')
    .map((i) => ({
      from: i.start && isAttach(i.start) ? i.start.itemId : null,
      to: i.end && isAttach(i.end) ? i.end.itemId : null,
      label: i.text,
    }));
}
