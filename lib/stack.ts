import type { Item } from './types';
import { boundsOf, isSection, itemKind } from './items';

export type RestackDir = 'forward' | 'back' | 'front' | 'backmost';

function isConn(i: Item) {
  return itemKind(i) === 'connector';
}

function restackLayer(layer: Item[], ids: Set<string>, dir: RestackDir): Item[] {
  const selected = layer.filter((i) => ids.has(i.id));
  if (!selected.length) return layer;
  if (dir === 'front') {
    return [...layer.filter((i) => !ids.has(i.id)), ...selected];
  }
  if (dir === 'backmost') {
    return [...selected, ...layer.filter((i) => !ids.has(i.id))];
  }
  const arr = [...layer];
  if (dir === 'forward') {
    for (let i = arr.length - 2; i >= 0; i--) {
      if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      }
    }
    return arr;
  }
  for (let i = 1; i < arr.length; i++) {
    if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) {
      [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
    }
  }
  return arr;
}

/** Restack selected items within their layer (sections, connectors, nodes). */
export function restack(items: Item[], ids: Iterable<string>, dir: RestackDir): Item[] {
  const set = ids instanceof Set ? ids : new Set(ids);
  const sections = restackLayer(items.filter(isSection), set, dir);
  const nodes = restackLayer(
    items.filter((i) => !isConn(i) && !isSection(i)),
    set,
    dir,
  );
  const conns = restackLayer(items.filter(isConn), set, dir);
  let s = 0;
  let n = 0;
  let c = 0;
  return items.map((i) => {
    if (isSection(i)) return sections[s++];
    if (isConn(i)) return conns[c++];
    return nodes[n++];
  });
}

function centerIn(it: Item, r: { x: number; y: number; w: number; h: number }) {
  const b = boundsOf(it);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
}

/** Add items whose centers sit inside a selected section. */
export function expandContained(items: Item[], ids: Iterable<string>): Set<string> {
  const seed = ids instanceof Set ? ids : new Set(ids);
  const sections = items.filter((i) => seed.has(i.id) && isSection(i));
  if (!sections.length) return seed;
  const out = new Set(seed);
  for (const sec of sections) {
    const r = boundsOf(sec);
    for (const it of items) {
      if (out.has(it.id) || isConn(it)) continue;
      if (centerIn(it, r)) out.add(it.id);
    }
  }
  return out;
}

/** Expand ids to whole groups when a member is included. */
export function expandGroups(items: Item[], ids: Iterable<string>): Set<string> {
  const seed = new Set(ids);
  const groups = new Set<string>();
  for (const it of items) {
    if (seed.has(it.id) && it.groupId) groups.add(it.groupId);
  }
  if (!groups.size) return seed;
  const out = new Set(seed);
  for (const it of items) {
    if (it.groupId && groups.has(it.groupId)) out.add(it.id);
  }
  return out;
}

export function unlockedIds(items: Item[], ids: Iterable<string>): string[] {
  const set = ids instanceof Set ? ids : new Set(ids);
  return items.filter((i) => set.has(i.id) && !i.locked).map((i) => i.id);
}
