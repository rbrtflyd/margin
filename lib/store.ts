import type { Board, Item, Store } from './types';

// v1 keeps everything in the browser. Swap loadStore/saveStore for a database later.
const KEY = 'margin:v1';

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

export function loadStore(): Store {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && s.v === 1 && Array.isArray(s.boards) && s.boards.length > 0) {
        if (!s.boards.some((b) => b.id === s.currentId)) s.currentId = s.boards[0].id;
        return s;
      }
    }
  } catch {
    // Unreadable storage: start fresh rather than crash.
  }
  const b = newBoard();
  return { v: 1, boards: [b], currentId: b.id };
}

export function saveStore(s: Store): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked. Nothing else to do in v1.
  }
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
  const items: Item[] = (src.items as unknown[]).filter(isItem).map((i) => ({
    id: i.id,
    x: i.x,
    y: i.y,
    w: typeof i.w === 'number' ? i.w : undefined,
    text: i.text,
    by: i.by === 'claude' ? 'claude' : 'me',
    createdAt: typeof i.createdAt === 'string' ? i.createdAt : t,
    editedAt: typeof i.editedAt === 'string' ? i.editedAt : t,
  }));
  return {
    ...newBoard(typeof src.name === 'string' && src.name.trim() ? src.name : 'Imported board'),
    items,
  };
}

export function exportJSON(b: Board): string {
  return JSON.stringify({ app: 'margin', version: 1, exportedAt: nowISO(), board: b }, null, 2);
}
