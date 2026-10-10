import type { Fill, Handle, Item, ItemKind, ShapeKind } from './types';

export const STICKY_SIZE = 160;
export const SHAPE_SIZE = 140;
export const MIN_SIZE = 40;

export function itemKind(it: Pick<Item, 'kind'>): ItemKind {
  return it.kind ?? 'text';
}

export const FILLS: Record<Fill, { bg: string; ink: string }> = {
  amber: { bg: '#fde68a', ink: '#422006' },
  rose: { bg: '#fecdd3', ink: '#4c0519' },
  sky: { bg: '#bae6fd', ink: '#082f49' },
  lime: { bg: '#d9f99d', ink: '#14532d' },
  stone: { bg: '#e7e5e4', ink: '#1c1917' },
  white: { bg: '#ffffff', ink: '#18181b' },
};

export const FILL_ORDER: Fill[] = [
  'white',
  'amber',
  'rose',
  'sky',
  'lime',
  'stone',
];

export const SHAPES: { id: ShapeKind; label: string; shortcut?: string }[] = [
  { id: 'rect', label: 'Square', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'roundRect', label: 'Rounded' },
];

export type Rect = { x: number; y: number; w: number; h: number };

export function storedRect(it: Item): Rect {
  const kind = itemKind(it);
  if (kind === 'sticky') {
    return {
      x: it.x,
      y: it.y,
      w: it.w ?? STICKY_SIZE,
      h: it.h ?? STICKY_SIZE,
    };
  }
  if (kind === 'shape') {
    return {
      x: it.x,
      y: it.y,
      w: it.w ?? SHAPE_SIZE,
      h: it.h ?? SHAPE_SIZE,
    };
  }
  return { x: it.x, y: it.y, w: it.w ?? 160, h: it.h ?? 28 };
}

const measured = new Map<string, { w: number; h: number }>();

/** Cache a measured world-unit size for items that size to their contents. */
export function rememberSize(id: string, w: number, h: number): boolean {
  const prev = measured.get(id);
  if (prev && prev.w === w && prev.h === h) return false;
  measured.set(id, { w, h });
  return true;
}

export function forgetSize(id: string) {
  measured.delete(id);
}

/** World-unit box. Uses stored `w`/`h` when set, else the last measured size. */
export function boundsOf(item: Item): Rect {
  const fallback = storedRect(item);
  const m = measured.get(item.id);
  return {
    x: item.x,
    y: item.y,
    w: item.w ?? m?.w ?? fallback.w,
    h: item.h ?? m?.h ?? fallback.h,
  };
}

export function applyResize(
  box: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  keepRatio: boolean,
  min = MIN_SIZE,
): Rect {
  const orig = box;
  let { x, y, w, h } = box;
  if (handle.includes('e')) w = orig.w + dx;
  if (handle.includes('w')) {
    w = orig.w - dx;
    x = orig.x + dx;
  }
  if (handle.includes('s')) h = orig.h + dy;
  if (handle.includes('n')) {
    h = orig.h - dy;
    y = orig.y + dy;
  }
  if (keepRatio && handle.length === 2 && orig.w > 0 && orig.h > 0) {
    const sx = w / orig.w;
    const sy = h / orig.h;
    const s = Math.abs(sx) > Math.abs(sy) ? sx : sy;
    w = orig.w * s;
    h = orig.h * s;
    if (handle.includes('w')) x = orig.x + orig.w - w;
    if (handle.includes('n')) y = orig.y + orig.h - h;
  }
  if (w < min) {
    if (handle.includes('w')) x = orig.x + orig.w - min;
    w = min;
  }
  if (h < min) {
    if (handle.includes('n')) y = orig.y + orig.h - min;
    h = min;
  }
  return { x, y, w, h };
}

export function compactItem(i: Item): Item {
  const out: Item = {
    id: i.id,
    x: i.x,
    y: i.y,
    text: i.text,
    by: i.by === 'claude' ? 'claude' : 'me',
    createdAt: i.createdAt,
    editedAt: i.editedAt,
  };
  if (typeof i.w === 'number') out.w = i.w;
  if (typeof i.h === 'number') out.h = i.h;
  if (i.kind) out.kind = i.kind;
  if (i.shape) out.shape = i.shape;
  if (i.fill) out.fill = i.fill;
  if (i.route) out.route = i.route;
  if (i.start) out.start = i.start;
  if (i.end) out.end = i.end;
  return out;
}
