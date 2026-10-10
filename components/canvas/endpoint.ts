import { snapAtEvent } from './connect';
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
  ctx.setEndDraft({
    id: d.id,
    which: d.which,
    anchor: snapAtEvent(ctx, e),
  });
}

export function endEndpoint(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'endpoint' }>,
  e: PointerEvent,
) {
  const anchor = snapAtEvent(ctx, e);
  if (d.moved) {
    ctx.propsRef.current.onPatch(
      d.id,
      d.which === 'start' ? { start: anchor } : { end: anchor },
    );
  }
  ctx.setEndDraft(null);
}
