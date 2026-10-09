'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { AskTurn, Author, Board, Item, Store, User, View } from '@/lib/types';
import { exportJSON, nowISO, parseImport, uid } from '@/lib/store';
import Canvas from './Canvas';
import type { CanvasApi, Pt } from './Canvas';
import AskPanel from './AskPanel';
import BoardsMenu from './BoardsMenu';

type History = { past: Item[][]; future: Item[][] };
const MAX_HISTORY = 100;

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

export default function Margin({ user }: { user: User | null }) {
  const [store, setStore] = useState<Store | null>(null);
  const storeRef = useRef<Store | null>(null);
  const hydrated = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [renameOnOpen, setRenameOnOpen] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const canvasApi = useRef<CanvasApi | null>(null);
  const histories = useRef(new Map<string, History>());
  const editSnapshot = useRef<{ id: string; items: Item[]; isNew: boolean } | null>(null);

  const { isAuthenticated } = useConvexAuth();
  const remote = useQuery(api.boards.queries.getStore, isAuthenticated ? {} : 'skip');
  const seed = useMutation(api.boards.mutations.seed);
  const save = useMutation(api.boards.mutations.save);
  const createRemote = useMutation(api.boards.mutations.create);
  const removeRemote = useMutation(api.boards.mutations.remove);

  useEffect(() => {
    if (!isAuthenticated || remote === undefined || hydrated.current) return;
    let cancelled = false;
    void (async () => {
      const next = remote ?? (await seed());
      if (cancelled || !next) return;
      storeRef.current = next;
      setStore(next);
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, remote, seed]);

  useEffect(() => {
    if (!store || !hydrated.current) return;
    const t = setTimeout(() => {
      void save({
        boards: store.boards.map((b) => ({
          id: b.id as Id<'boards'>,
          name: b.name,
          items: b.items,
          view: b.view,
          asks: b.asks,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        })),
        currentId: store.currentId as Id<'boards'>,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [store, save]);

  // All writes go through here so consecutive updates in one event see each other.
  const update = useCallback((fn: (s: Store) => Store) => {
    const s = storeRef.current;
    if (!s) return;
    const next = fn(s);
    storeRef.current = next;
    setStore(next);
  }, []);

  const currentBoard = (): Board | null => {
    const s = storeRef.current;
    return s ? s.boards.find((b) => b.id === s.currentId) ?? null : null;
  };

  const hist = (id: string): History => {
    let h = histories.current.get(id);
    if (!h) {
      h = { past: [], future: [] };
      histories.current.set(id, h);
    }
    return h;
  };

  const pushHistory = (boardId: string, items: Item[]) => {
    const h = hist(boardId);
    h.past.push(items);
    if (h.past.length > MAX_HISTORY) h.past.shift();
    h.future = [];
  };

  /** Replace the current board's items. record=true makes it undoable. */
  const commitItems = (producer: (items: Item[]) => Item[], record = true) => {
    const b = currentBoard();
    if (!b) return;
    const next = producer(b.items);
    if (next === b.items) return;
    if (record) pushHistory(b.id, b.items);
    update((s) => ({
      ...s,
      boards: s.boards.map((x) => (x.id === b.id ? { ...x, items: next, updatedAt: nowISO() } : x)),
    }));
  };

  const patchBoard = (id: string, patch: Partial<Board>) => {
    update((s) => ({ ...s, boards: s.boards.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  };

  const doFlash = (ids: string[]) => {
    setFlash(ids);
    setTimeout(() => setFlash((f) => (f === ids ? [] : f)), 2400);
  };

  // ----- items -----

  const createAt = (p: Pt, text = '', by: Author = 'me') => {
    const b = currentBoard();
    if (!b) return '';
    const t = nowISO();
    const item: Item = { id: uid('t_'), x: Math.round(p.x), y: Math.round(p.y), text, by, createdAt: t, editedAt: t };
    if (!text) {
      editSnapshot.current = { id: item.id, items: b.items, isNew: true };
      commitItems((items) => [...items, item], false);
      setSelected(new Set([item.id]));
      setEditingId(item.id);
    } else {
      commitItems((items) => [...items, item], true);
      setSelected(new Set([item.id]));
    }
    return item.id;
  };

  const startEdit = (id: string) => {
    const b = currentBoard();
    if (!b) return;
    editSnapshot.current = { id, items: b.items, isNew: false };
    setSelected(new Set([id]));
    setEditingId(id);
  };

  const commitEdit = (id: string, raw: string) => {
    const snap = editSnapshot.current && editSnapshot.current.id === id ? editSnapshot.current : null;
    editSnapshot.current = null;
    setEditingId((e) => (e === id ? null : e));
    const b = currentBoard();
    if (!b) return;
    const cur = b.items.find((i) => i.id === id);
    if (!cur) return;
    const text = raw.replace(/ /g, ' ').replace(/^\n+/, '').replace(/\s+$/, '');
    if (!text.trim()) {
      // An emptied box goes away. A brand-new empty box leaves no trace in undo.
      commitItems((items) => items.filter((i) => i.id !== id), !(snap && snap.isNew));
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      return;
    }
    if (text === cur.text) return;
    const edited = (items: Item[]) => items.map((i) => (i.id === id ? { ...i, text, editedAt: nowISO() } : i));
    if (snap && snap.isNew) {
      pushHistory(b.id, snap.items);
      commitItems(edited, false);
    } else {
      commitItems(edited, true);
    }
  };

  const moveItems = (ids: string[], dx: number, dy: number) => {
    const set = new Set(ids);
    commitItems((items) => items.map((i) => (set.has(i.id) ? { ...i, x: Math.round(i.x + dx), y: Math.round(i.y + dy) } : i)));
  };

  const deleteSelected = () => {
    const sel = selectedRef.current;
    if (!sel.size) return;
    commitItems((items) => items.filter((i) => !sel.has(i.id)));
    setSelected(new Set());
  };

  const undo = () => {
    const b = currentBoard();
    if (!b) return;
    const h = hist(b.id);
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(b.items);
    commitItems(() => prev, false);
    setEditingId(null);
    setSelected((s) => new Set(Array.from(s).filter((id) => prev.some((i) => i.id === id))));
  };

  const redo = () => {
    const b = currentBoard();
    if (!b) return;
    const h = hist(b.id);
    const next = h.future.pop();
    if (!next) return;
    h.past.push(b.items);
    commitItems(() => next, false);
    setEditingId(null);
  };

  /** Where a new box should go: under the pointer, else the middle of the view. */
  const dropPoint = (): Pt => {
    const api = canvasApi.current;
    if (!api) return { x: 0, y: 0 };
    return api.pointer() ?? api.center();
  };

  const putOnCanvas = (text: string) => {
    const api = canvasApi.current;
    const sel = Array.from(selectedRef.current);
    let p: Pt = api ? api.center() : { x: 0, y: 0 };
    if (api && sel.length) {
      const rects = sel.map((id) => api.rectOf(id)).filter((r): r is NonNullable<typeof r> => !!r);
      if (rects.length) {
        const right = Math.max(...rects.map((r) => r.x + r.w));
        const top = Math.min(...rects.map((r) => r.y));
        p = { x: right + 48, y: top };
      }
    } else if (api) {
      p = { x: p.x - 140, y: p.y - 40 };
    }
    const id = createAt(p, text, 'claude');
    if (id) {
      doFlash([id]);
      api?.panTo({ x: p.x + 140, y: p.y + 40 });
    }
  };

  // ----- boards -----

  const switchBoard = (id: string) => {
    setSelected(new Set());
    setEditingId(null);
    update((s) => ({ ...s, currentId: id }));
  };

  const createBoard = () => {
    void createRemote({}).then((b) => {
      setSelected(new Set());
      setEditingId(null);
      update((s) => ({ ...s, boards: [...s.boards, b], currentId: b.id }));
      setRenameOnOpen(true);
    });
  };

  const deleteBoard = (id: string) => {
    histories.current.delete(id);
    update((s) => {
      const boards = s.boards.filter((b) => b.id !== id);
      if (!boards.length) return s;
      return { ...s, boards, currentId: s.currentId === id ? boards[0].id : s.currentId };
    });
    setSelected(new Set());
    void removeRemote({ id: id as Id<'boards'> });
  };

  const exportBoard = (id: string) => {
    const s = storeRef.current;
    const b = s ? s.boards.find((x) => x.id === id) : undefined;
    if (!b) return;
    const blob = new Blob([exportJSON(b)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${b.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'board'}.margin.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importBoard = (text: string): string | null => {
    const result = parseImport(text);
    if (typeof result === 'string') return result;
    void createRemote({
      name: result.name,
      items: result.items,
      view: result.view,
      asks: result.asks,
    }).then((b) => {
      update((s) => ({ ...s, boards: [...s.boards, b], currentId: b.id }));
      setSelected(new Set());
    });
    return null;
  };

  // ----- keyboard, paste, copy -----

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const actions = useRef({ deleteSelected, undo, redo, createAt, dropPoint, startEdit });
  actions.current = { deleteSelected, undo, redo, createAt, dropPoint, startEdit };
  const panelsRef = useRef({ askOpen, boardsOpen });
  panelsRef.current = { askOpen, boardsOpen };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'k') {
        e.preventDefault();
        setBoardsOpen(false);
        setAskOpen((o) => !o);
        return;
      }
      if (isEditable(e.target) || e.defaultPrevented) return;
      const a = actions.current;
      if (e.key === 'Escape') {
        if (panelsRef.current.boardsOpen) setBoardsOpen(false);
        else if (panelsRef.current.askOpen) setAskOpen(false);
        else setSelected(new Set());
        return;
      }
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) a.redo();
        else a.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        a.redo();
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        const b = currentBoard();
        if (b) setSelected(new Set(b.items.map((i) => i.id)));
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        a.deleteSelected();
      } else if (key === 't') {
        e.preventDefault();
        const p = a.dropPoint();
        a.createAt({ x: p.x - 8, y: p.y - 14 });
      } else if (e.key === '/') {
        e.preventDefault();
        setAskOpen(true);
      } else if (e.key === 'Enter' && selectedRef.current.size === 1) {
        e.preventDefault();
        a.startEdit(Array.from(selectedRef.current)[0]);
      } else if (e.shiftKey && e.code === 'Digit1') {
        canvasApi.current?.fit();
      } else if (e.shiftKey && e.code === 'Digit0') {
        canvasApi.current?.zoomTo(1);
      }
    };

    // Paste text anywhere on the canvas to drop it in as a box.
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (!text.trim()) return;
      e.preventDefault();
      const a = actions.current;
      const p = a.dropPoint();
      a.createAt({ x: p.x - 8, y: p.y - 14 }, text.replace(/\r\n/g, '\n').trim());
    };

    // Copy selected boxes as plain text, for pasting into other tools.
    const onCopy = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const b = currentBoard();
      const sel = selectedRef.current;
      if (!b || !sel.size || !e.clipboardData) return;
      const text = b.items
        .filter((i) => sel.has(i.id))
        .sort((x, y) => x.y - y.y || x.x - y.x)
        .map((i) => i.text)
        .join('\n\n');
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);
    document.addEventListener('copy', onCopy);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('copy', onCopy);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!store) return <div className="fixed inset-0" />;
  const board = store.boards.find((b) => b.id === store.currentId) ?? store.boards[0];

  return (
    <div className="fixed inset-0">
      <Canvas
        key={board.id}
        items={board.items}
        initialView={board.view}
        selected={selected}
        editingId={editingId}
        flash={flash}
        apiRef={canvasApi}
        onSelect={setSelected}
        onMove={moveItems}
        onCreateAt={(p) => createAt(p)}
        onEditStart={startEdit}
        onEditCommit={commitEdit}
        onViewChange={(v: View) => patchBoard(board.id, { view: v })}
        onZoom={setZoom}
      />

      {board.items.length === 0 && !editingId && (
        <div
          className="pointer-events-none fixed top-[42%] left-1/2 w-full -translate-x-1/2 -translate-y-1/2 px-4 text-center"
          aria-hidden="true"
        >
          <p className="m-0 font-serif text-[22px] leading-snug font-normal text-zinc-500 italic">Double-click anywhere to write.</p>
          <p className="mt-2 font-mono text-xs font-normal text-zinc-400">Paste to drop text in &middot; &#8984;K to ask</p>
        </div>
      )}

      <nav
        className="fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-1/2 z-20 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-0.5 rounded-xl border border-stone-300 bg-white/80 p-1 shadow-xl backdrop-blur-md"
        aria-label="Toolbar"
      >
        <button
          type="button"
          className="inline-flex max-w-[220px] min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-[13.5px] font-semibold whitespace-nowrap hover:bg-zinc-900/10 aria-expanded:bg-zinc-900 aria-expanded:text-stone-100 max-sm:px-2"
          data-boards-toggle
          aria-expanded={boardsOpen}
          onClick={() => {
            setRenameOnOpen(false);
            setBoardsOpen((o) => !o);
          }}
        >
          <span className="truncate">{board.name}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <span className="mx-1 h-5 w-px shrink-0 bg-stone-300" />
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-[13.5px] whitespace-nowrap hover:bg-zinc-900/10 max-sm:px-2"
          title="New text (T)"
          onClick={() => {
            const c = canvasApi.current ? canvasApi.current.center() : { x: 0, y: 0 };
            createAt({ x: c.x - 120, y: c.y - 14 });
          }}
        >
          Text <kbd className="font-mono text-[10.5px] font-medium text-zinc-400 max-sm:hidden">T</kbd>
        </button>
        <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-[13.5px] whitespace-nowrap hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100 aria-pressed:[&_kbd]:text-current aria-pressed:[&_kbd]:opacity-70 max-sm:px-2" aria-pressed={askOpen} title={'Ask (⌘K)'} onClick={() => setAskOpen((o) => !o)}>
          Ask <kbd className="font-mono text-[10.5px] font-medium text-zinc-400 max-sm:hidden">&#8984;K</kbd>
        </button>
        <span className="mx-1 h-5 w-px shrink-0 bg-stone-300" />
        <button
          type="button"
          className="inline-flex min-w-[54px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent px-2.5 py-1.5 font-mono text-xs font-medium whitespace-nowrap text-zinc-500 tabular-nums hover:bg-zinc-900/10 max-sm:px-2"
          title="Zoom to fit (Shift+1)"
          onClick={() => canvasApi.current?.fit()}
        >
          {Math.round(zoom * 100)}%
        </button>
      </nav>

      {boardsOpen && (
        <BoardsMenu
          boards={store.boards}
          currentId={board.id}
          user={user}
          startRenaming={renameOnOpen}
          onSwitch={(id) => {
            switchBoard(id);
            setBoardsOpen(false);
          }}
          onCreate={createBoard}
          onRename={(id, name) => {
            patchBoard(id, { name, updatedAt: nowISO() });
            setRenameOnOpen(false);
          }}
          onDelete={(id) => {
            deleteBoard(id);
            setBoardsOpen(false);
          }}
          onExport={exportBoard}
          onImport={(text) => {
            const err = importBoard(text);
            if (!err) setBoardsOpen(false);
            return err;
          }}
          onClose={() => setBoardsOpen(false)}
        />
      )}

      {askOpen && (
        <AskPanel
          key={`ask-${board.id}`}
          boardName={board.name}
          items={board.items}
          selectedIds={Array.from(selected)}
          turns={board.asks}
          onTurns={(turns: AskTurn[]) => patchBoard(board.id, { asks: turns })}
          onPut={putOnCanvas}
          onClose={() => setAskOpen(false)}
        />
      )}
    </div>
  );
}
