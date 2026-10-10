import type { Item } from '@/lib/types';
import { boundsOf, hasRect, mapBox, type Rect } from '@/lib/items';
import type { ResizeLive } from './types';

export function liveRects(
  items: Item[],
  dragging: { ids: Set<string>; x: number; y: number } | null,
  resize: ResizeLive | null,
): Map<string, Rect> {
  const m = new Map<string, Rect>();
  const scaled = resize ? new Set(resize.ids) : null;
  for (const it of items) {
    if (!hasRect(it)) continue;
    if (resize && scaled?.has(it.id)) {
      m.set(it.id, mapBox(resize.from, resize.to, boundsOf(it)));
      continue;
    }
    const box = boundsOf(it);
    const ox = dragging && dragging.ids.has(it.id) ? dragging.x : 0;
    const oy = dragging && dragging.ids.has(it.id) ? dragging.y : 0;
    m.set(it.id, { x: box.x + ox, y: box.y + oy, w: box.w, h: box.h });
  }
  return m;
}
