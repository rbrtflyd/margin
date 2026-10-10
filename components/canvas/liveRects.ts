import type { Item } from '@/lib/types';
import { itemKind, storedRect, type Rect } from '@/lib/items';

export function liveRects(
  items: Item[],
  els: Map<string, Element>,
  dragging: { ids: Set<string>; x: number; y: number } | null,
  resize: Rect & { id: string } | null,
): Map<string, Rect> {
  const m = new Map<string, Rect>();
  for (const it of items) {
    if (itemKind(it) === 'connector') continue;
    if (resize && resize.id === it.id) {
      m.set(it.id, {
        x: resize.x,
        y: resize.y,
        w: resize.w,
        h: resize.h,
      });
      continue;
    }
    const el = els.get(it.id);
    const ox = dragging && dragging.ids.has(it.id) ? dragging.x : 0;
    const oy = dragging && dragging.ids.has(it.id) ? dragging.y : 0;
    if (el instanceof HTMLElement) {
      m.set(it.id, {
        x: it.x + ox,
        y: it.y + oy,
        w: el.offsetWidth,
        h: el.offsetHeight,
      });
    } else {
      const r = storedRect(it);
      m.set(it.id, { x: r.x + ox, y: r.y + oy, w: r.w, h: r.h });
    }
  }
  return m;
}
