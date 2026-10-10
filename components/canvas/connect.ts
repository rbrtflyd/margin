import { isAttach, SNAP, snapAnchor } from '@/lib/connectors';
import type { Anchor, Side } from '@/lib/types';
import type { Drag, InteractionCtx } from './types';

function snap(
  ctx: InteractionCtx,
  world: { x: number; y: number },
  excludeId?: string,
  asAuto = true,
) {
  return snapAnchor(
    world,
    ctx.currentRects(),
    SNAP / ctx.viewRef.current.k,
    excludeId,
    asAuto,
  );
}

export function snapAtEvent(
  ctx: InteractionCtx,
  e: { clientX: number; clientY: number },
  excludeId?: string,
): Anchor {
  const el = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest<HTMLElement>('[data-dot]');
  if (
    el &&
    el.dataset.item &&
    el.dataset.item !== excludeId &&
    el.dataset.dot
  ) {
    return { itemId: el.dataset.item, side: el.dataset.dot as Side };
  }
  return snap(ctx, ctx.toWorld(e.clientX, e.clientY), excludeId, true);
}

export function startConnect(ctx: InteractionCtx, world: { x: number; y: number }): Drag {
  return {
    kind: 'connector',
    start: snap(ctx, world, undefined, true),
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
  const exclude = isAttach(d.start) ? d.start.itemId : undefined;
  ctx.setDraftLine({
    start: d.start,
    end: snapAtEvent(ctx, e, exclude),
  });
}

export function endConnect(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'connector' }>,
  e: PointerEvent,
) {
  const exclude = isAttach(d.start) ? d.start.itemId : undefined;
  const end = snapAtEvent(ctx, e, exclude);
  ctx.setDraftLine(null);
  if (!d.moved) return;
  const p = ctx.propsRef.current;
  p.onCreate({
    kind: 'connector',
    x: 0,
    y: 0,
    text: '',
    route: p.tool.type === 'connector' ? p.tool.route : 'straight',
    start: d.start,
    end,
  });
}
