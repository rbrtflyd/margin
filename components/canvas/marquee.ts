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
  const left = Math.min(d.sx, e.clientX);
  const right = Math.max(d.sx, e.clientX);
  const top = Math.min(d.sy, e.clientY);
  const bottom = Math.max(d.sy, e.clientY);
  const hits = new Set(d.base);
  ctx.els.current.forEach((el, id) => {
    const b = el.getBoundingClientRect();
    if (b.right >= left && b.left <= right && b.bottom >= top && b.top <= bottom)
      hits.add(id);
  });
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
