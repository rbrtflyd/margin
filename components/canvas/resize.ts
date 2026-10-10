import type { Handle } from '@/lib/types';
import { GUIDE_PX, snapResizeRect } from '@/lib/align';
import {
  applyResize,
  boundsOf,
  isBox,
  itemKind,
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
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'resize' }>,
  e: {
    clientX: number;
    clientY: number;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
  },
): Rect {
  const k = ctx.viewRef.current.k;
  const items = ctx.propsRef.current.items;
  const lockRatio =
    d.ids.length > 0 &&
    d.ids.every((id) => {
      const it = items.find((i) => i.id === id);
      return it && itemKind(it) === 'image';
    });
  let box = applyResize(
    { x: d.x, y: d.y, w: d.w, h: d.h },
    d.handle,
    (e.clientX - d.sx) / k,
    (e.clientY - d.sy) / k,
    lockRatio ? !e.shiftKey : e.shiftKey,
    undefined,
    e.altKey,
  );
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd) {
    ctx.setGuides(null);
    return box;
  }
  const idSet = new Set(d.ids);
  const others = ctx.propsRef.current.items
    .filter((i) => !idSet.has(i.id) && isBox(i))
    .map(boundsOf);
  const snapped = snapResizeRect(
    box,
    others,
    GUIDE_PX / k,
    ctx.propsRef.current.snapGrid,
  );
  ctx.setGuides(
    snapped.guides.v.length ||
      snapped.guides.h.length ||
      snapped.guides.ticks.length
      ? snapped.guides
      : null,
  );
  return snapped.box;
}

export function moveResize(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'resize' }>,
  e: PointerEvent,
) {
  const from = { x: d.x, y: d.y, w: d.w, h: d.h };
  const to = liveBox(ctx, d, e);
  ctx.setResize({ ids: d.ids, from, to });
}

export function endResize(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'resize' }>,
  e: PointerEvent,
) {
  const from = { x: d.x, y: d.y, w: d.w, h: d.h };
  const to = liveBox(ctx, d, e);
  const p = ctx.propsRef.current;
  if (d.moved) {
    if (d.ids.length === 1) p.onResize(d.ids[0], to, d.handle);
    else p.onResizeAll(d.ids, from, to);
  }
  ctx.setResize(null);
  ctx.setGuides(null);
}
