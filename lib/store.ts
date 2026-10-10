import type {
  Anchor,
  Board,
  Fill,
  Item,
  ItemKind,
  Route,
  ShapeKind,
  Side,
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

const KINDS: ItemKind[] = ['text', 'sticky', 'shape', 'connector'];
const SHAPES: ShapeKind[] = [
  'rect',
  'ellipse',
  'diamond',
  'triangle',
  'roundRect',
];
const FILLS: Fill[] = ['amber', 'rose', 'sky', 'lime', 'stone', 'white'];
const ROUTES: Route[] = ['straight', 'elbow'];
const SIDES: Side[] = ['n', 'e', 's', 'w'];

function asOne<T extends string>(x: unknown, allowed: T[]): T | undefined {
  return typeof x === 'string' && (allowed as string[]).includes(x)
    ? (x as T)
    : undefined;
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
      fill: asOne(i.fill, FILLS),
      route: asOne(i.route, ROUTES),
      start: asAnchor(i.start),
      end: asAnchor(i.end),
    }),
  );
  return {
    ...newBoard(typeof src.name === 'string' && src.name.trim() ? src.name : 'Imported board'),
    items,
  };
}

export function exportJSON(b: Board): string {
  return JSON.stringify({ app: 'margin', version: 1, exportedAt: nowISO(), board: b }, null, 2);
}
