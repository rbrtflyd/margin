import type { Handle } from '@/lib/types';
import {
  applyResize,
  isBox,
  storedRect,
  unionRect,
  type Rect,
} from '@/lib/items';
import { unlockedIds } from '@/lib/stack';
import type { Drag, InteractionCtx } from './types';

function origBox(
  ctx: InteractionCtx,
  ids: string[],
): Rect | null {
  const items = ctx.propsRef.current.items;
  const rects = ctx.currentRects();
  const boxes: Rect[] = [];
  for (const id of ids) {
    const it = items.find((i) => i.id === id);
    if (!it || !isBox(it)) continue;
    boxes.push(rects.get(id) ?? storedRect(it));
  }
  return unionRect(boxes);
}

export function startResize(
  ctx: InteractionCtx,
  ids: string[],
  handle: Handle,
  e: { clientX: number; clientY: number },
): Drag | null {
  const movable = unlockedIds(ctx.propsRef.current.items, ids);
  if (!movable.length) return null;
  const box = origBox(ctx, movable);
  if (!box) return null;
  return {
    kind: 'resize',
    ids: movable,
    handle,
    sx: e.clientX,
    sy: e.clientY,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    moved: false,
  };
}

function liveBox(
  d: Extract<Drag, { kind: 'resize' }>,
  e: { clientX: number; clientY: number; shiftKey: boolean; altKey: boolean },
  k: number,
): Rect {
  return applyResize(
    { x: d.x, y: d.y, w: d.w, h: d.h },
    d.handle,
    (e.clientX - d.sx) / k,
    (e.clientY - d.sy) / k,
    e.shiftKey,
    undefined,
    e.altKey,
  );
}

export function moveResize(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'resize' }>,
  e: PointerEvent,
) {
  const from = { x: d.x, y: d.y, w: d.w, h: d.h };
  const to = liveBox(d, e, ctx.viewRef.current.k);
  ctx.setResize({ ids: d.ids, from, to });
}

export function endResize(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'resize' }>,
  e: PointerEvent,
) {
  const from = { x: d.x, y: d.y, w: d.w, h: d.h };
  const to = liveBox(d, e, ctx.viewRef.current.k);
  const p = ctx.propsRef.current;
  if (d.moved) {
    if (d.ids.length === 1) p.onResize(d.ids[0], to, d.handle);
    else p.onResizeAll(d.ids, from, to);
  }
  ctx.setResize(null);
}
