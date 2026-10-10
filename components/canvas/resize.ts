import type { Handle } from '@/lib/types';
import { applyResize, itemKind, storedRect } from '@/lib/items';
import type { Drag, InteractionCtx } from './types';

export function startResize(
  ctx: InteractionCtx,
  id: string,
  handle: Handle,
  e: { clientX: number; clientY: number },
): Drag | null {
  const it = ctx.propsRef.current.items.find((i) => i.id === id);
  if (!it) return null;
  const box = ctx.currentRects().get(id) ?? storedRect(it);
  const kind = itemKind(it);
  return {
    kind: 'resize',
    id,
    handle,
    sx: e.clientX,
    sy: e.clientY,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    keepRatio: (kind === 'shape' || kind === 'sticky') && handle.length === 2,
    moved: false,
  };
}

export function moveResize(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'resize' }>,
  e: PointerEvent,
) {
  const dx = e.clientX - d.sx;
  const dy = e.clientY - d.sy;
  const k = ctx.viewRef.current.k;
  const box = applyResize(
    { x: d.x, y: d.y, w: d.w, h: d.h },
    d.handle,
    dx / k,
    dy / k,
    d.keepRatio,
  );
  ctx.setResize({ id: d.id, ...box });
}

export function endResize(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'resize' }>,
  e: PointerEvent,
) {
  const k = ctx.viewRef.current.k;
  const box = applyResize(
    { x: d.x, y: d.y, w: d.w, h: d.h },
    d.handle,
    (e.clientX - d.sx) / k,
    (e.clientY - d.sy) / k,
    d.keepRatio,
  );
  if (d.moved) ctx.propsRef.current.onResize(d.id, box, d.handle);
  ctx.setResize(null);
}
