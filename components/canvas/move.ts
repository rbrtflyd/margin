import type { Drag, InteractionCtx } from './types';

export function startMove(
  ctx: InteractionCtx,
  e: { clientX: number; clientY: number; shiftKey: boolean },
  itemId: string,
): Drag | null {
  const p = ctx.propsRef.current;
  const wasSelected = p.selected.has(itemId);
  if (e.shiftKey) {
    const next = new Set(p.selected);
    if (wasSelected) next.delete(itemId);
    else next.add(itemId);
    p.onSelect(next);
    if (wasSelected) return null;
    return {
      kind: 'move',
      sx: e.clientX,
      sy: e.clientY,
      ids: Array.from(next),
      clickId: itemId,
      wasSelected,
      shift: true,
      moved: false,
    };
  }
  const ids = wasSelected ? Array.from(p.selected) : [itemId];
  if (!wasSelected) p.onSelect(new Set([itemId]));
  return {
    kind: 'move',
    sx: e.clientX,
    sy: e.clientY,
    ids,
    clickId: itemId,
    wasSelected,
    shift: false,
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
    const k = ctx.viewRef.current.k;
    p.onMove(d.ids, (e.clientX - d.sx) / k, (e.clientY - d.sy) / k);
  } else if (!d.shift && d.wasSelected && p.selected.size > 1) {
    p.onSelect(new Set([d.clickId]));
  }
  ctx.setDragging(null);
}
