import type { Anchor, Item } from './types';
import { boundsOf, compactItem, hasRect, itemKind, type Rect } from './items';
import { detachAnchor, isAttach, nodeRects } from './connectors';
import { nowISO, uid } from './store';

export const MARGIN_ITEMS_MIME = 'web application/x-margin-items+json';

export function shiftItem(i: Item, dx: number, dy: number): Item {
  if (itemKind(i) === 'connector') {
    return {
      ...i,
      start:
        i.start && !isAttach(i.start)
          ? { x: Math.round(i.start.x + dx), y: Math.round(i.start.y + dy) }
          : i.start,
      end:
        i.end && !isAttach(i.end)
          ? { x: Math.round(i.end.x + dx), y: Math.round(i.end.y + dy) }
          : i.end,
    };
  }
  return { ...i, x: Math.round(i.x + dx), y: Math.round(i.y + dy) };
}

function remapAnchor(
  anchor: Anchor | undefined,
  idMap: Map<string, string>,
  rects: ReturnType<typeof nodeRects>,
): Anchor | undefined {
  if (!anchor || !isAttach(anchor)) return anchor;
  const next = idMap.get(anchor.itemId);
  if (next) return { ...anchor, itemId: next };
  return detachAnchor(anchor, new Set([anchor.itemId]), rects);
}

function nextGroupIds(source: Item[], board: Item[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const ids = new Set(source.map((i) => i.id));
  const groups = new Set(
    source.map((i) => i.groupId).filter((g): g is string => !!g),
  );
  for (const g of groups) {
    const members = board.filter((i) => i.groupId === g);
    const allCopied = members.length > 0 && members.every((i) => ids.has(i.id));
    out.set(g, allCopied ? uid('g_') : null);
  }
  return out;
}

/** Clone `source` (a subset of `board`) with new ids, remapped connectors, and remapped groups. */
export function cloneItems(source: Item[], board: Item[]): Item[] {
  const t = nowISO();
  const idMap = new Map<string, string>();
  for (const i of source) {
    const prefix =
      itemKind(i) === 'text' ? 't_' : (i.kind?.[0] ?? 't') + '_';
    idMap.set(i.id, uid(prefix));
  }
  const rects = nodeRects(board);
  const groups = nextGroupIds(source, board);
  return source.map((i) => {
    const groupId = i.groupId ? groups.get(i.groupId) : undefined;
    return compactItem({
      ...i,
      id: idMap.get(i.id) ?? uid('t_'),
      createdAt: t,
      editedAt: t,
      groupId: groupId || undefined,
      start: remapAnchor(i.start, idMap, rects),
      end: remapAnchor(i.end, idMap, rects),
    });
  });
}

export function unionBounds(items: Item[]): Rect | null {
  const boxes = items.filter(hasRect).map(boundsOf);
  if (!boxes.length) {
    const pts = items.filter((i) => itemKind(i) === 'connector');
    if (!pts.length) return null;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const i of pts) {
      x0 = Math.min(x0, i.x);
      y0 = Math.min(y0, i.y);
      x1 = Math.max(x1, i.x);
      y1 = Math.max(y1, i.y);
    }
    if (!Number.isFinite(x0)) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function encodeItems(items: Item[]): string {
  return JSON.stringify({ v: 2, items });
}

export function decodeItems(raw: string): Item[] | null {
  try {
    const data = JSON.parse(raw) as { v?: number; items?: unknown };
    if (!data || !Array.isArray(data.items)) return null;
    return data.items.filter(
      (i): i is Item =>
        !!i &&
        typeof i === 'object' &&
        typeof (i as Item).id === 'string' &&
        typeof (i as Item).text === 'string' &&
        typeof (i as Item).x === 'number' &&
        typeof (i as Item).y === 'number',
    );
  } catch {
    return null;
  }
}
