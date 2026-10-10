import { snapAnchor } from '@/lib/connectors';
import type { Drag, InteractionCtx } from './types';

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
    anchor: snapAnchor(w, ctx.currentRects()),
  });
}

export function endEndpoint(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'endpoint' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  const anchor = snapAnchor(w, ctx.currentRects());
  if (d.moved) {
    ctx.propsRef.current.onPatch(
      d.id,
      d.which === 'start' ? { start: anchor } : { end: anchor },
    );
  }
  ctx.setEndDraft(null);
}
