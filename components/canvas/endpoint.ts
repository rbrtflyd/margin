import { SNAP, snapAnchor } from '@/lib/connectors';
import type { Drag, InteractionCtx } from './types';

function snap(ctx: InteractionCtx, world: { x: number; y: number }) {
  return snapAnchor(
    world,
    ctx.currentRects(),
    SNAP / ctx.viewRef.current.k,
  );
}

export function startEndpoint(
  itemId: string,
  which: 'start' | 'end',
): Drag {
  return { kind: 'endpoint', id: itemId, which, moved: false };
}

export function moveEndpoint(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'endpoint' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  ctx.setEndDraft({
    id: d.id,
    which: d.which,
    anchor: snap(ctx, w),
  });
}

export function endEndpoint(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'endpoint' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  const anchor = snap(ctx, w);
  if (d.moved) {
    ctx.propsRef.current.onPatch(
      d.id,
      d.which === 'start' ? { start: anchor } : { end: anchor },
    );
  }
  ctx.setEndDraft(null);
}
