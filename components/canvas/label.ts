import { itemConnectorPoints, nearestT } from '@/lib/connectors';
import type { Drag, InteractionCtx } from './types';

export function startLabel(id: string): Drag {
  return { kind: 'label', id, moved: false };
}

export function moveLabel(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'label' }>,
  e: PointerEvent,
) {
  const it = ctx.propsRef.current.items.find((i) => i.id === d.id);
  if (!it) return;
  const pts = itemConnectorPoints(it, ctx.currentRects());
  const w = ctx.toWorld(e.clientX, e.clientY);
  const t = Math.min(1, Math.max(0, nearestT(pts, w)));
  ctx.propsRef.current.onPatch(d.id, { labelAt: t }, 'labelAt');
}

export function endLabel(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'label' }>,
  e: PointerEvent,
) {
  if (!d.moved) return;
  moveLabel(ctx, d, e);
}
