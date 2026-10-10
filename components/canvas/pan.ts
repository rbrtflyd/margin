import type { Drag, InteractionCtx } from './types';

export function startPan(
  ctx: InteractionCtx,
  e: PointerEvent | { clientX: number; clientY: number },
): Drag {
  const v = ctx.viewRef.current;
  ctx.setPanning(true);
  return {
    kind: 'pan',
    sx: e.clientX,
    sy: e.clientY,
    vx: v.x,
    vy: v.y,
    moved: false,
  };
}

export function movePan(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'pan' }>,
  e: PointerEvent,
) {
  const dx = e.clientX - d.sx;
  const dy = e.clientY - d.sy;
  ctx.setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
}

export function endPan(ctx: InteractionCtx) {
  ctx.setPanning(false);
}
