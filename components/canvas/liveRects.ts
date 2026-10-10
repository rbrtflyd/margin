import type { Item } from '@/lib/types';
import { boundsOf, itemKind, type Rect } from '@/lib/items';

export function liveRects(
  items: Item[],
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
    const box = boundsOf(it);
    const ox = dragging && dragging.ids.has(it.id) ? dragging.x : 0;
    const oy = dragging && dragging.ids.has(it.id) ? dragging.y : 0;
    m.set(it.id, { x: box.x + ox, y: box.y + oy, w: box.w, h: box.h });
  }
  return m;
}
