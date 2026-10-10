import { SNAP, snapAnchor } from '@/lib/connectors';
import type { Drag, InteractionCtx } from './types';

function snap(ctx: InteractionCtx, world: { x: number; y: number }) {
  return snapAnchor(
    world,
    ctx.currentRects(),
    SNAP / ctx.viewRef.current.k,
  );
}

export function startConnect(ctx: InteractionCtx, world: { x: number; y: number }): Drag {
  return {
    kind: 'connector',
    start: snap(ctx, world),
    moved: false,
  };
}

export function moveConnect(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'connector' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  ctx.setDraftLine({
    start: d.start,
    end: snap(ctx, w),
  });
}

export function endConnect(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'connector' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  const end = snap(ctx, w);
  ctx.setDraftLine(null);
  if (!d.moved) return;
  const p = ctx.propsRef.current;
  p.onCreate({
    kind: 'connector',
    x: 0,
    y: 0,
    text: '',
    route: p.tool.type === 'connector' ? (p.tool.route as 'straight' | 'elbow') : 'straight',
    start: d.start,
    end,
  });
}
