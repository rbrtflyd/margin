import type {
  Align,
  Fill,
  FontSize,
  Handle,
  Item,
  ItemKind,
  ShapeKind,
  Stroke,
  StrokeStyle,
  StrokeWidth,
} from './types';

export const STICKY_SIZE = 160;
export const STICKY_WIDE = 320;
export const SHAPE_SIZE = 140;
export const IMAGE_SIZE = 320;
export const LINK_W = 280;
export const LINK_H = 160;
export const MIN_SIZE = 40;
export const FONT_PX: Record<FontSize, number> = {
  s: 12,
  m: 14,
  l: 18,
  xl: 24,
};

export function fontPx(item: Item): number {
  return FONT_PX[item.fontSize ?? 'm'];
}

export function textAlign(item: Item): Align {
  if (item.align) return item.align;
  return itemKind(item) === 'shape' ? 'center' : 'left';
}

export function itemKind(it: Pick<Item, 'kind'>): ItemKind {
  return it.kind ?? 'text';
}

export const INK = '#18181b';

export const FILLS: Record<Fill, { bg: string; ink: string }> = {
  white: { bg: '#ffffff', ink: '#18181b' },
  stone: { bg: '#e7e5e4', ink: '#1c1917' },
  amber: { bg: '#fde68a', ink: '#422006' },
  orange: { bg: '#fed7aa', ink: '#7c2d12' },
  yellow: { bg: '#fef08a', ink: '#713f12' },
  lime: { bg: '#d9f99d', ink: '#14532d' },
  teal: { bg: '#99f6e4', ink: '#134e4a' },
  sky: { bg: '#bae6fd', ink: '#082f49' },
  violet: { bg: '#ddd6fe', ink: '#4c1d95' },
  fuchsia: { bg: '#f5d0fe', ink: '#701a75' },
  rose: { bg: '#fecdd3', ink: '#4c0519' },
  red: { bg: '#fecaca', ink: '#7f1d1d' },
};

export type Paint = {
  bg: string;
  ink: string;
  claude: boolean;
  fillNone: boolean;
};

/** Paint tokens for an item. Claude always uses sky, ignoring style fields. */
export function paintOf(item: Item): Paint {
  if (item.by === 'claude') {
    return { ...FILLS.sky, claude: true, fillNone: false };
  }
  if (item.fill === 'none') {
    return { bg: 'none', ink: INK, claude: false, fillNone: true };
  }
  const name =
    item.fill ?? (itemKind(item) === 'sticky' ? 'amber' : 'white');
  return { ...FILLS[name], claude: false, fillNone: false };
}

export type StrokePaint = {
  color: string;
  width: number;
  dash?: string;
};

export function strokeOf(item: Item): StrokePaint | null {
  const paint = paintOf(item);
  if (item.by === 'claude') {
    return {
      color: `color-mix(in oklab, ${FILLS.sky.ink} 28%, transparent)`,
      width: 1.5,
    };
  }
  if (item.stroke === 'none') return null;
  const color = !item.stroke
    ? `color-mix(in oklab, ${paint.ink} 28%, transparent)`
    : item.stroke === 'ink'
      ? INK
      : FILLS[item.stroke].ink;
  const width = item.strokeWidth ?? (item.stroke ? 1 : 1.5);
  const dash =
    item.strokeStyle === 'dashed'
      ? '8 6'
      : item.strokeStyle === 'dotted'
        ? '1.5 4'
        : undefined;
  return { color, width, dash };
}

export function textInk(item: Item): string {
  const paint = paintOf(item);
  if (item.by === 'claude') return paint.ink;
  if (item.textColor === 'ink') return INK;
  if (item.textColor) return FILLS[item.textColor].ink;
  return paint.ink;
}

export type ItemStyle = {
  fill?: Fill | 'none';
  stroke?: Stroke;
  strokeWidth?: StrokeWidth;
  strokeStyle?: StrokeStyle;
  textColor?: Fill | 'ink';
  fontSize?: FontSize;
  align?: Align;
};

export function styleOf(item: Item): ItemStyle {
  const out: ItemStyle = {};
  if (item.fill) out.fill = item.fill;
  if (item.stroke) out.stroke = item.stroke;
  if (item.strokeWidth) out.strokeWidth = item.strokeWidth;
  if (item.strokeStyle) out.strokeStyle = item.strokeStyle;
  if (item.textColor) out.textColor = item.textColor;
  if (item.fontSize) out.fontSize = item.fontSize;
  if (item.align) out.align = item.align;
  return out;
}

export function isBox(it: Pick<Item, 'kind'>): boolean {
  const k = itemKind(it);
  return (
    k === 'text' ||
    k === 'sticky' ||
    k === 'shape' ||
    k === 'image' ||
    k === 'link' ||
    k === 'embed'
  );
}

export const FILL_ORDER: Fill[] = [
  'white',
  'stone',
  'amber',
  'orange',
  'yellow',
  'lime',
  'teal',
  'sky',
  'violet',
  'fuchsia',
  'rose',
  'red',
];

export const SHAPES: { id: ShapeKind; label: string; shortcut?: string }[] = [
  { id: 'rect', label: 'Square', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'roundRect', label: 'Rounded' },
  { id: 'parallelogram', label: 'Parallelogram' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'document', label: 'Document' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'star', label: 'Star' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'speech', label: 'Speech' },
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
  if (kind === 'image') {
    return {
      x: it.x,
      y: it.y,
      w: it.w ?? IMAGE_SIZE,
      h: it.h ?? IMAGE_SIZE,
    };
  }
  if (kind === 'link' || kind === 'embed') {
    return {
      x: it.x,
      y: it.y,
      w: it.w ?? LINK_W,
      h: it.h ?? LINK_H,
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
  fromCenter = false,
): Rect {
  const orig = box;
  let { x, y, w, h } = box;
  if (fromCenter) {
    if (handle.includes('e') || handle.includes('w')) {
      const dw = handle.includes('e') ? dx : -dx;
      w = orig.w + 2 * dw;
      x = orig.x - dw;
    }
    if (handle.includes('s') || handle.includes('n')) {
      const dh = handle.includes('s') ? dy : -dy;
      h = orig.h + 2 * dh;
      y = orig.y - dh;
    }
  } else {
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
  }
  if (keepRatio && orig.w > 0 && orig.h > 0) {
    if (handle.length === 2) {
      const sx = w / orig.w;
      const sy = h / orig.h;
      const s = Math.abs(sx) > Math.abs(sy) ? sx : sy;
      w = orig.w * s;
      h = orig.h * s;
      if (fromCenter) {
        x = orig.x + orig.w / 2 - w / 2;
        y = orig.y + orig.h / 2 - h / 2;
      } else {
        if (handle.includes('w')) x = orig.x + orig.w - w;
        if (handle.includes('n')) y = orig.y + orig.h - h;
      }
    } else if (handle === 'e' || handle === 'w') {
      h = w * (orig.h / orig.w);
      if (fromCenter) y = orig.y + orig.h / 2 - h / 2;
      else y = orig.y + (orig.h - h) / 2;
    } else if (handle === 'n' || handle === 's') {
      w = h * (orig.w / orig.h);
      if (fromCenter) x = orig.x + orig.w / 2 - w / 2;
      else x = orig.x + (orig.w - w) / 2;
    }
  }
  if (w < min) {
    if (fromCenter) x = orig.x + orig.w / 2 - min / 2;
    else if (handle.includes('w')) x = orig.x + orig.w - min;
    w = min;
  }
  if (h < min) {
    if (fromCenter) y = orig.y + orig.h / 2 - min / 2;
    else if (handle.includes('n')) y = orig.y + orig.h - min;
    h = min;
  }
  return { x, y, w, h };
}

export function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const b of rects) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function mapPoint(
  from: Rect,
  to: Rect,
  p: { x: number; y: number },
): { x: number; y: number } {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  return {
    x: to.x + (p.x - from.x) * sx,
    y: to.y + (p.y - from.y) * sy,
  };
}

export function mapBox(from: Rect, to: Rect, box: Rect): Rect {
  const a = mapPoint(from, to, { x: box.x, y: box.y });
  const b = mapPoint(from, to, { x: box.x + box.w, y: box.y + box.h });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

/** Scale a box or a connector's free ends from `from` onto `to`. */
export function scaleItem(i: Item, from: Rect, to: Rect): Item {
  if (itemKind(i) === 'connector') {
    const mapAnchor = (a: Item['start']) => {
      if (!a || 'itemId' in a) return a;
      const p = mapPoint(from, to, a);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    };
    return { ...i, start: mapAnchor(i.start), end: mapAnchor(i.end) };
  }
  const b = mapBox(from, to, boundsOf(i));
  return {
    ...i,
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.w),
    h: Math.round(b.h),
  };
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
  if (i.stroke) out.stroke = i.stroke;
  if (i.strokeWidth) out.strokeWidth = i.strokeWidth;
  if (i.strokeStyle) out.strokeStyle = i.strokeStyle;
  if (i.textColor) out.textColor = i.textColor;
  if (i.fontSize) out.fontSize = i.fontSize;
  if (i.align) out.align = i.align;
  if (i.locked) out.locked = true;
  if (i.groupId) out.groupId = i.groupId;
  if (i.route) out.route = i.route;
  if (typeof i.bend === 'number') out.bend = i.bend;
  if (typeof i.labelAt === 'number') out.labelAt = i.labelAt;
  if (i.arrowStart) out.arrowStart = i.arrowStart;
  if (i.arrowEnd) out.arrowEnd = i.arrowEnd;
  if (i.start) out.start = i.start;
  if (i.end) out.end = i.end;
  if (i.assetId) out.assetId = i.assetId;
  if (i.url) out.url = i.url;
  if (i.meta) out.meta = i.meta;
  if (i.caption) out.caption = i.caption;
  return out;
}
