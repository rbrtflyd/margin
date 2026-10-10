import type { Drag, InteractionCtx } from './types';

export function startBend(
  e: PointerEvent | { clientX: number; clientY: number },
  id: string,
  axis: 'x' | 'y',
  world: { x: number; y: number },
  origin: number,
): Drag {
  return {
    kind: 'bend',
    id,
    axis,
    sx: e.clientX,
    sy: e.clientY,
    wx: world.x,
    wy: world.y,
    origin,
    moved: false,
  };
}

export function moveBend(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'bend' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  const delta = d.axis === 'x' ? w.x - d.wx : w.y - d.wy;
  ctx.propsRef.current.onPatch(d.id, { bend: d.origin + delta }, 'bend');
}

export function endBend(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'bend' }>,
  e: PointerEvent,
) {
  if (!d.moved) return;
  moveBend(ctx, d, e);
}
