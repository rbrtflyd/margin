import type { Item } from './types';
import { itemKind } from './items';

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

/** Restack selected items within their layer (connectors vs nodes). */
export function restack(items: Item[], ids: Iterable<string>, dir: RestackDir): Item[] {
  const set = ids instanceof Set ? ids : new Set(ids);
  const nodes = restackLayer(
    items.filter((i) => !isConn(i)),
    set,
    dir,
  );
  const conns = restackLayer(
    items.filter(isConn),
    set,
    dir,
  );
  let n = 0;
  let c = 0;
  return items.map((i) => (isConn(i) ? conns[c++] : nodes[n++]));
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
