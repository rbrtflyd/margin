import { expandGroups, unlockedIds } from '@/lib/stack';
import type { Drag, InteractionCtx } from './types';

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
  const dx = e.clientX - d.sx;
  const dy = e.clientY - d.sy;
  const k = ctx.viewRef.current.k;
  ctx.setDragging({ ids: new Set(d.ids), x: dx / k, y: dy / k });
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
      return;
    }
    const k = ctx.viewRef.current.k;
    const dx = (e.clientX - d.sx) / k;
    const dy = (e.clientY - d.sy) / k;
    if (d.duplicate) p.onDuplicateMove(d.ids, dx, dy);
    else p.onMove(d.ids, dx, dy);
  } else if (!d.shift && d.wasSelected && p.selected.size > 1) {
    const it = p.items.find((i) => i.id === d.clickId);
    const groupHits =
      it?.groupId &&
      p.items.some(
        (i) => i.groupId === it.groupId && i.id !== it.id && p.selected.has(i.id),
      );
    if (!groupHits) p.onSelect(new Set([d.clickId]));
  }
  ctx.setDragging(null);
}
