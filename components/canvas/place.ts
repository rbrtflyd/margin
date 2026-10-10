import type { ShapeKind } from '@/lib/types';
import { SECTION_H, SECTION_W } from '@/lib/items';
import type { Drag, InteractionCtx } from './types';

export function startPlace(
  e: { clientX: number; clientY: number },
  world: { x: number; y: number },
): Drag {
  return {
    kind: 'place',
    sx: e.clientX,
    sy: e.clientY,
    wx: world.x,
    wy: world.y,
    moved: false,
  };
}

export function movePlace(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'place' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  ctx.setPlaceBox({
    x: Math.min(d.wx, w.x),
    y: Math.min(d.wy, w.y),
    w: Math.abs(w.x - d.wx),
    h: Math.abs(w.y - d.wy),
  });
}

export function endPlace(
  ctx: InteractionCtx,
  d: Extract<Drag, { kind: 'place' }>,
  e: PointerEvent,
) {
  const w = ctx.toWorld(e.clientX, e.clientY);
  ctx.setPlaceBox(null);
  const p = ctx.propsRef.current;
  if (d.moved) {
    const t = p.textStyle;
    p.onCreate({
      kind: 'text',
      x: Math.min(d.wx, w.x),
      y: Math.min(d.wy, w.y),
      w: Math.max(40, Math.abs(w.x - d.wx)),
      text: '',
      fontSize: t.fontSize,
      align: t.align,
      textColor: t.textColor,
      edit: true,
    });
  } else {
    const t = p.textStyle;
    p.onCreate({
      kind: 'text',
      x: d.wx,
      y: d.wy,
      text: '',
      fontSize: t.fontSize,
      align: t.align,
      textColor: t.textColor,
      edit: true,
    });
  }
}

export function placeSticky(
  ctx: InteractionCtx,
  world: { x: number; y: number },
) {
  const p = ctx.propsRef.current;
  const s = p.stickyStyle;
  p.onCreate({
    kind: 'sticky',
    x: world.x - 80,
    y: world.y - 80,
    w: 160,
    fill: s.fill && s.fill !== 'none' ? s.fill : 'amber',
    fontSize: s.fontSize,
    align: s.align,
    textColor: s.textColor,
    text: '',
    edit: true,
  });
}

export function placeShape(
  ctx: InteractionCtx,
  world: { x: number; y: number },
  shape: ShapeKind,
) {
  const p = ctx.propsRef.current;
  const s = p.shapeStyle;
  p.onCreate({
    kind: 'shape',
    shape,
    x: world.x - 70,
    y: world.y - 70,
    w: 140,
    h: 140,
    fill: s.fill ?? 'white',
    stroke: s.stroke,
    strokeWidth: s.strokeWidth,
    strokeStyle: s.strokeStyle,
    textColor: s.textColor,
    fontSize: s.fontSize,
    align: s.align,
    text: '',
    edit: true,
  });
}

export function placeSection(
  ctx: InteractionCtx,
  world: { x: number; y: number },
) {
  ctx.propsRef.current.onCreate({
    kind: 'section',
    x: world.x - SECTION_W / 2,
    y: world.y - SECTION_H / 2,
    w: SECTION_W,
    h: SECTION_H,
    text: '',
    edit: true,
  });
}
