import type { Item } from './types';

export function itemSearchText(item: Item): string {
  return [
    item.text,
    item.caption,
    item.meta?.title,
    item.meta?.description,
    item.url,
  ]
    .filter((s): s is string => !!s)
    .join(' ');
}

export function findMatches(items: Item[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return items
    .filter((it) => itemSearchText(it).toLowerCase().includes(q))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((it) => it.id);
}
