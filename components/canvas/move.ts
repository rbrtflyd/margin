import { GUIDE_PX, snapDragDelta } from '@/lib/align';
import { boundsOf, isBox, itemKind, unionRect } from '@/lib/items';
import { expandGroups, unlockedIds } from '@/lib/stack';
import type { Drag, InteractionCtx } from './types';

function snapMove(
  ctx: InteractionCtx,
  ids: string[],
  dx: number,
  dy: number,
  e: { metaKey: boolean; ctrlKey: boolean },
) {
  const cmd = e.metaKey || e.ctrlKey;
  const items = ctx.propsRef.current.items;
  const idSet = new Set(ids);
  const orig = unionRect(
    items.filter((i) => idSet.has(i.id) && isBox(i)).map(boundsOf),
  );
  if (!orig) return { dx, dy, guides: null };
  const others = items
    .filter((i) => !idSet.has(i.id) && isBox(i))
    .map(boundsOf);
  return snapDragDelta(
    orig,
    others,
    dx,
    dy,
    GUIDE_PX / ctx.viewRef.current.k,
    ctx.propsRef.current.snapGrid && !cmd,
    cmd,
  );
}

export function startMove(
  ctx: InteractionCtx,
  e: { clientX: number; clientY: number; shiftKey: boolean; altKey: boolean },
  itemId: string,
): Drag | null {
  const p = ctx.propsRef.current;
  const items = p.items;
  const group = expandGroups(items, [itemId]);
  const wasSelected = p.selected.has(itemId);
  if (e.shiftKey) {
    const next = new Set(p.selected);
    if (wasSelected) {
      for (const id of group) next.delete(id);
    } else {
      for (const id of group) next.add(id);
    }
    p.onSelect(next);
    if (wasSelected) return null;
    const ids = unlockedIds(items, next);
    return {
      kind: 'move',
      sx: e.clientX,
      sy: e.clientY,
      ids,
      clickId: itemId,
      wasSelected,
      shift: true,
      duplicate: e.altKey,
      moved: false,
    };
  }
  const raw = wasSelected ? Array.from(p.selected) : Array.from(group);
  if (!wasSelected) p.onSelect(new Set(raw));
  const ids = unlockedIds(items, raw);
  return {
    kind: 'move',
    sx: e.clientX,
    sy: e.clientY,
    ids,
    clickId: itemId,
    wasSelected,
    shift: false,
    duplicate: e.altKey,
    moved: false,
  };
}

export function moveMove(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'move' }>,
  e: PointerEvent,
) {
  const k = ctx.viewRef.current.k;
  const rawX = (e.clientX - d.sx) / k;
  const rawY = (e.clientY - d.sy) / k;
  const snapped = snapMove(ctx, d.ids, rawX, rawY, e);
  ctx.setDragging({ ids: new Set(d.ids), x: snapped.dx, y: snapped.dy });
  ctx.setGuides(snapped.guides);
}

export function endMove(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'move' }>,
  e: PointerEvent,
) {
  const p = ctx.propsRef.current;
  if (d.moved) {
    if (!d.ids.length) {
      ctx.setDragging(null);
      ctx.setGuides(null);
      return;
    }
    const k = ctx.viewRef.current.k;
    const snapped = snapMove(
      ctx,
      d.ids,
      (e.clientX - d.sx) / k,
      (e.clientY - d.sy) / k,
      e,
    );
    if (d.duplicate) p.onDuplicateMove(d.ids, snapped.dx, snapped.dy);
    else p.onMove(d.ids, snapped.dx, snapped.dy);
  } else if (!d.moved) {
    const it = p.items.find((i) => i.id === d.clickId);
    if (it && itemKind(it) === 'link' && it.url && !d.shift) {
      window.open(it.url, '_blank', 'noopener,noreferrer');
    } else if (!d.shift && d.wasSelected && p.selected.size > 1) {
      const groupHits =
        it?.groupId &&
        p.items.some(
          (i) => i.groupId === it.groupId && i.id !== it.id && p.selected.has(i.id),
        );
      if (!groupHits) p.onSelect(new Set([d.clickId]));
    }
  }
  ctx.setDragging(null);
  ctx.setGuides(null);
}
