import type {
  Align,
  Anchor,
  Arrowhead,
  Board,
  Fill,
  FontSize,
  Item,
  ItemKind,
  LinkMeta,
  Route,
  ShapeKind,
  Side,
  Stroke,
  StrokeStyle,
  StrokeWidth,
} from './types';
import { compactItem } from './items';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function newBoard(name = 'Untitled board'): Board {
  const t = nowISO();
  return { id: uid('b_'), name, items: [], view: null, asks: [], createdAt: t, updatedAt: t };
}

const KINDS: ItemKind[] = [
  'text',
  'sticky',
  'shape',
  'connector',
  'image',
  'link',
  'embed',
  'section',
];
const SHAPES: ShapeKind[] = [
  'rect',
  'ellipse',
  'diamond',
  'triangle',
  'roundRect',
  'parallelogram',
  'cylinder',
  'document',
  'hexagon',
  'star',
  'chevron',
  'speech',
];
const FILLS: Fill[] = ['amber', 'rose', 'sky', 'lime', 'stone', 'white'];
const FILL_OR_NONE = [...FILLS, 'none'] as const;
const STROKES: Stroke[] = [...FILLS, 'ink', 'none'];
const TEXT_COLORS = [...FILLS, 'ink'] as const;
const STROKE_WIDTHS: StrokeWidth[] = [1, 2, 4];
const STROKE_STYLES: StrokeStyle[] = ['solid', 'dashed', 'dotted'];
const FONT_SIZES: FontSize[] = ['s', 'm', 'l', 'xl'];
const ALIGNS: Align[] = ['left', 'center', 'right'];
const ROUTES: Route[] = ['straight', 'elbow', 'curved'];
const SIDES: (Side | 'auto')[] = ['n', 'e', 's', 'w', 'auto'];
const ARROWS: Arrowhead[] = ['none', 'arrow', 'triangle', 'circle'];

function asOne<T extends string | number>(x: unknown, allowed: readonly T[]): T | undefined {
  return (allowed as readonly unknown[]).includes(x) ? (x as T) : undefined;
}

function asAnchor(x: unknown): Anchor | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const a = x as Record<string, unknown>;
  if (typeof a.itemId === 'string') {
    const side = asOne(a.side, SIDES);
    return side ? { itemId: a.itemId, side } : undefined;
  }
  if (typeof a.x === 'number' && typeof a.y === 'number') {
    return { x: a.x, y: a.y };
  }
  return undefined;
}

function asMeta(x: unknown): LinkMeta | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const m = x as Record<string, unknown>;
  const meta: LinkMeta = {};
  if (typeof m.title === 'string') meta.title = m.title;
  if (typeof m.description === 'string') meta.description = m.description;
  if (typeof m.siteName === 'string') meta.siteName = m.siteName;
  if (typeof m.thumb === 'string') meta.thumb = m.thumb;
  if (typeof m.provider === 'string') meta.provider = m.provider;
  return meta;
}

function isItem(x: unknown): x is Item {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  return typeof i.id === 'string' && typeof i.text === 'string' && typeof i.x === 'number' && typeof i.y === 'number';
}

/** Accepts a file written by "Export board" and returns a fresh board (new id) or an error message. */
export function parseImport(text: string): Board | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return 'That file isn’t valid JSON.';
  }
  const src = (data && typeof data === 'object' && 'board' in data ? (data as { board: unknown }).board : data) as Record<string, unknown> | null;
  if (!src || typeof src !== 'object' || !Array.isArray(src.items)) return 'That file doesn’t look like a Margin board.';
  const t = nowISO();
  const items: Item[] = (src.items as unknown[]).filter(isItem).map((i) =>
    compactItem({
      id: i.id,
      x: i.x,
      y: i.y,
      w: typeof i.w === 'number' ? i.w : undefined,
      h: typeof i.h === 'number' ? i.h : undefined,
      text: i.text,
      by: i.by === 'claude' ? 'claude' : 'me',
      createdAt: typeof i.createdAt === 'string' ? i.createdAt : t,
      editedAt: typeof i.editedAt === 'string' ? i.editedAt : t,
      kind: asOne(i.kind, KINDS),
      shape: asOne(i.shape, SHAPES),
      fill: asOne(i.fill, FILL_OR_NONE),
      stroke: asOne(i.stroke, STROKES),
      strokeWidth: asOne(i.strokeWidth, STROKE_WIDTHS),
      strokeStyle: asOne(i.strokeStyle, STROKE_STYLES),
      textColor: asOne(i.textColor, TEXT_COLORS),
      fontSize: asOne(i.fontSize, FONT_SIZES),
      align: asOne(i.align, ALIGNS),
      locked: i.locked === true ? true : undefined,
      groupId: typeof i.groupId === 'string' ? i.groupId : undefined,
      route: asOne(i.route, ROUTES),
      bend: typeof i.bend === 'number' ? i.bend : undefined,
      labelAt: typeof i.labelAt === 'number' ? i.labelAt : undefined,
      arrowStart: asOne(i.arrowStart, ARROWS),
      arrowEnd: asOne(i.arrowEnd, ARROWS),
      start: asAnchor(i.start),
      end: asAnchor(i.end),
      assetId: typeof i.assetId === 'string' ? i.assetId : undefined,
      url: typeof i.url === 'string' ? i.url : undefined,
      meta: asMeta(i.meta),
      caption: typeof i.caption === 'string' ? i.caption : undefined,
    }),
  );
  return {
    ...newBoard(typeof src.name === 'string' && src.name.trim() ? src.name : 'Imported board'),
    items,
  };
}

export function exportJSON(b: Board): string {
  return JSON.stringify({ app: 'margin', version: 2, exportedAt: nowISO(), board: b }, null, 2);
}
