import { isAttach, SNAP, snapAnchor } from '@/lib/connectors';
import type { Anchor } from '@/lib/types';
import type { Drag, InteractionCtx } from './types';

function snap(
  ctx: InteractionCtx,
  world: { x: number; y: number },
  excludeId?: string,
) {
  return snapAnchor(
    world,
    ctx.currentRects(),
    SNAP / ctx.viewRef.current.k,
    excludeId,
  );
}

export function startConnect(ctx: InteractionCtx, world: { x: number; y: number }): Drag {
  return {
    kind: 'connector',
    start: snap(ctx, world),
    moved: false,
  };
}

export function startConnectFrom(start: Anchor): Drag {
  return {
    kind: 'connector',
    start,
    moved: false,
  };
}

export function moveConnect(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'connector' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  const exclude = isAttach(d.start) ? d.start.itemId : undefined;
  ctx.setDraftLine({
    start: d.start,
    end: snap(ctx, w, exclude),
  });
}

export function endConnect(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'connector' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  const exclude = isAttach(d.start) ? d.start.itemId : undefined;
  const end = snap(ctx, w, exclude);
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
