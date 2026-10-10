import { boundsOf, itemKind } from '@/lib/items';
import {
  connectorPoints,
  resolveAnchor,
} from '@/lib/connectors';
import type { Drag, InteractionCtx } from './types';

export function startMarquee(
  ctx: InteractionCtx,
  e: { clientX: number; clientY: number; shiftKey: boolean },
): Drag {
  const p = ctx.propsRef.current;
  return {
    kind: 'marquee',
    sx: e.clientX,
    sy: e.clientY,
    base: e.shiftKey ? new Set(p.selected) : new Set(),
    moved: false,
  };
}

function intersects(
  box: { x: number; y: number; w: number; h: number },
  left: number,
  right: number,
  top: number,
  bottom: number,
) {
  return (
    box.x + box.w >= left &&
    box.x <= right &&
    box.y + box.h >= top &&
    box.y <= bottom
  );
}

export function moveMarquee(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'marquee' }>,
  e: PointerEvent,
) {
  const r = ctx.rootRect();
  if (!r) return;
  ctx.setMarquee({
    x0: d.sx - r.left,
    y0: d.sy - r.top,
    x1: e.clientX - r.left,
    y1: e.clientY - r.top,
  });
  const a = ctx.toWorld(d.sx, d.sy);
  const b = ctx.toWorld(e.clientX, e.clientY);
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const hits = new Set(d.base);
  const rects = ctx.currentRects();
  for (const it of ctx.propsRef.current.items) {
    if (itemKind(it) === 'connector') {
      const s = resolveAnchor(it.start, rects, { x: it.x, y: it.y });
      const end = resolveAnchor(it.end, rects, { x: it.x, y: it.y });
      const pts = connectorPoints(s, end, it.route ?? 'straight');
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
      if (intersects({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, left, right, top, bottom))
        hits.add(it.id);
      continue;
    }
    if (intersects(boundsOf(it), left, right, top, bottom)) hits.add(it.id);
  }
  ctx.previewRef.current = hits;
  ctx.setPreview(hits);
}

export function endMarquee(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'marquee' }>,
) {
  const p = ctx.propsRef.current;
  if (d.moved) p.onSelect(ctx.previewRef.current ?? new Set());
  else p.onSelect(new Set());
  ctx.previewRef.current = null;
  ctx.setPreview(null);
  ctx.setMarquee(null);
}
