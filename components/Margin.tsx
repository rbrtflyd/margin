'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type {
  AskTurn,
  Author,
  Board,
  Fill,
  Handle,
  Item,
  Store,
  Tool,
  User,
  View,
} from '@/lib/types';
import { exportJSON, nowISO, parseImport, uid } from '@/lib/store';
import { compactItem, itemKind, type Rect } from '@/lib/items';
import { detachAnchor, isAttach, nodeRects } from '@/lib/connectors';
import { nextHistory } from '@/lib/history';
import Canvas from './Canvas';
import type { CanvasApi, CreateDraft, Pt } from './Canvas';
import { toast } from '@/components/ui/toast';
import AskPanel from './AskPanel';
import BoardSwitcher from './BoardSwitcher';
import CanvasToolbar from './CanvasToolbar';
import SaveStatus, { type SaveStatusKind } from './SaveStatus';
import UserMenu from './UserMenu';

type History = {
  past: Item[][];
  future: Item[][];
  coalesceKey?: string;
  at?: number;
};
const MAX_HISTORY = 100;

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.isContentEditable ||
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT'
  );
}

export default function Margin({ user }: { user: User | null }) {
  const [store, setStore] = useState<Store | null>(null);
  const storeRef = useRef<Store | null>(null);
  const hydrated = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [renameOnOpen, setRenameOnOpen] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>({ type: 'select' });
  const [stickyFill, setStickyFill] = useState<Fill>('amber');
  const canvasApi = useRef<CanvasApi | null>(null);
  const histories = useRef(new Map<string, History>());
  const editSnapshot = useRef<{
    id: string;
    items: Item[];
    isNew: boolean;
  } | null>(null);

  const { isAuthenticated } = useConvexAuth();
  const remote = useQuery(
    api.boards.queries.getStore,
    isAuthenticated ? {} : 'skip',
  );
  const seed = useMutation(api.boards.mutations.seed);
  const saveBoard = useMutation(api.boards.mutations.saveBoard);
  const setCurrentRemote = useMutation(api.boards.mutations.setCurrentBoard);
  const createRemote = useMutation(api.boards.mutations.create);
  const removeRemote = useMutation(api.boards.mutations.remove);

  const dirtyGens = useRef(new Map<string, number>());
  const conflicted = useRef(new Set<string>());
  const syncedAt = useRef(new Map<string, string>());
  const inflight = useRef(0);
  const flushing = useRef(false);
  const networkError = useRef(false);
  const online = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatusKind>('saved');

  const refreshSaveStatus = useCallback(() => {
    if (!online.current || networkError.current) {
      setSaveStatus('offline');
      return;
    }
    let pending = false;
    for (const id of dirtyGens.current.keys()) {
      if (!conflicted.current.has(id)) {
        pending = true;
        break;
      }
    }
    setSaveStatus(inflight.current > 0 || pending ? 'saving' : 'saved');
  }, []);

  const markDirty = (id: string) => {
    dirtyGens.current.set(id, (dirtyGens.current.get(id) ?? 0) + 1);
  };

  const flushSavesRef = useRef<() => Promise<void>>(async () => {});

  const scheduleSave = useCallback(() => {
    refreshSaveStatus();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void flushSavesRef.current();
    }, 250);
  }, [refreshSaveStatus]);

  flushSavesRef.current = async () => {
    if (flushing.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const s = storeRef.current;
    if (!s || !online.current) {
      refreshSaveStatus();
      return;
    }
    const ids = [...dirtyGens.current.keys()].filter(
      (id) => !conflicted.current.has(id),
    );
    if (!ids.length) {
      refreshSaveStatus();
      return;
    }
    flushing.current = true;
    try {
      for (const id of ids) {
        if (conflicted.current.has(id) || !online.current) continue;
        const b = storeRef.current?.boards.find((x) => x.id === id);
        if (!b) {
          dirtyGens.current.delete(id);
          continue;
        }
        const gen = dirtyGens.current.get(id);
        const expected = syncedAt.current.get(id) ?? b.updatedAt;
        inflight.current++;
        refreshSaveStatus();
        try {
          const result = await saveBoard({
            id: id as Id<'boards'>,
            name: b.name,
            items: b.items.map(compactItem),
            view: b.view,
            asks: b.asks,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
            expectedUpdatedAt: expected,
          });
          networkError.current = false;
          if (!result.ok) {
            dirtyGens.current.delete(id);
            if (result.reason === 'conflict') {
              conflicted.current.add(id);
              toast.add({
                type: 'warning',
                title: 'This board was edited in another tab',
                description:
                  'Reload to see those changes. Your edits here are still on this page.',
                actionProps: {
                  children: 'Reload',
                  onClick: () => location.reload(),
                },
              });
            }
          } else {
            syncedAt.current.set(id, b.updatedAt);
            if (dirtyGens.current.get(id) === gen) dirtyGens.current.delete(id);
          }
        } catch {
          networkError.current = true;
          online.current = typeof navigator === 'undefined' ? false : navigator.onLine;
          break;
        } finally {
          inflight.current--;
        }
      }
    } finally {
      flushing.current = false;
      refreshSaveStatus();
      if (
        !networkError.current &&
        online.current &&
        [...dirtyGens.current.keys()].some((id) => !conflicted.current.has(id))
      ) {
        scheduleSave();
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated || remote === undefined || hydrated.current) return;
    let cancelled = false;
    void (async () => {
      const next = remote ?? (await seed());
      if (cancelled || !next) return;
      storeRef.current = next;
      setStore(next);
      for (const b of next.boards) syncedAt.current.set(b.id, b.updatedAt);
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, remote, seed]);

  useEffect(() => {
    if (!store || !hydrated.current) return;
    scheduleSave();
  }, [store, scheduleSave]);

  useEffect(() => {
    const onOnline = () => {
      online.current = true;
      networkError.current = false;
      refreshSaveStatus();
      void flushSavesRef.current();
    };
    const onOffline = () => {
      online.current = false;
      refreshSaveStatus();
    };
    const onVisibility = () => {
      if (document.hidden) void flushSavesRef.current();
    };
    online.current = navigator.onLine;
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshSaveStatus]);

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
    return s ? (s.boards.find((b) => b.id === s.currentId) ?? null) : null;
  };

  const hist = (id: string): History => {
    let h = histories.current.get(id);
    if (!h) {
      h = { past: [], future: [] };
      histories.current.set(id, h);
    }
    return h;
  };

  const pushHistory = (
    boardId: string,
    items: Item[],
    coalesceKey?: string,
  ) => {
    const h = hist(boardId);
    const snap = nextHistory(
      { past: h.past, coalesceKey: h.coalesceKey, at: h.at },
      items,
      coalesceKey,
      Date.now(),
    );
    h.past = snap.past;
    if (h.past.length > MAX_HISTORY) h.past.shift();
    h.coalesceKey = snap.coalesceKey;
    h.at = snap.at;
    h.future = [];
  };

  /** Replace the current board's items. record=true makes it undoable. */
  const commitItems = (
    producer: (items: Item[]) => Item[],
    record = true,
    coalesceKey?: string,
  ) => {
    const b = currentBoard();
    if (!b) return;
    const next = producer(b.items);
    if (next === b.items) return;
    if (record) pushHistory(b.id, b.items, coalesceKey);
    markDirty(b.id);
    update((s) => ({
      ...s,
      boards: s.boards.map((x) =>
        x.id === b.id ? { ...x, items: next, updatedAt: nowISO() } : x,
      ),
    }));
  };

  const patchBoard = (id: string, patch: Partial<Board>) => {
    const keys = Object.keys(patch).filter((k) => k !== 'updatedAt');
    const viewOnly = keys.length === 1 && keys[0] === 'view';
    markDirty(id);
    update((s) => ({
      ...s,
      boards: s.boards.map((x) =>
        x.id === id
          ? {
              ...x,
              ...patch,
              ...(viewOnly ? {} : { updatedAt: patch.updatedAt ?? nowISO() }),
            }
          : x,
      ),
    }));
  };

  const doFlash = (ids: string[]) => {
    setFlash(ids);
    setTimeout(() => setFlash((f) => (f === ids ? [] : f)), 2400);
  };

  // ----- items -----

  const createItem = (draft: CreateDraft) => {
    const b = currentBoard();
    if (!b) return '';
    const t = nowISO();
    const kind = draft.kind ?? 'text';
    const item = compactItem({
      id: uid(kind === 'text' ? 't_' : kind[0] + '_'),
      x: Math.round(draft.x),
      y: Math.round(draft.y),
      text: draft.text ?? '',
      by: draft.by ?? 'me',
      createdAt: t,
      editedAt: t,
      kind: kind === 'text' ? undefined : kind,
      w: draft.w,
      h: draft.h,
      shape: draft.shape,
      fill: draft.fill,
      route: draft.route,
      start: draft.start,
      end: draft.end,
    });
    if (item.fill && item.fill !== 'none' && kind === 'sticky')
      setStickyFill(item.fill);
    const startEdit = draft.edit === true || (draft.edit !== false && kind !== 'connector' && !item.text);
    if (startEdit) {
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

  const createAt = (p: Pt, text = '', by: Author = 'me') =>
    createItem({ kind: 'text', x: p.x, y: p.y, text, by, edit: !text });

  const startEdit = (id: string) => {
    const b = currentBoard();
    if (!b) return;
    editSnapshot.current = { id, items: b.items, isNew: false };
    setSelected(new Set([id]));
    setEditingId(id);
  };

  const commitEdit = (id: string, raw: string) => {
    const snap =
      editSnapshot.current && editSnapshot.current.id === id
        ? editSnapshot.current
        : null;
    editSnapshot.current = null;
    setEditingId((e) => (e === id ? null : e));
    const b = currentBoard();
    if (!b) return;
    const cur = b.items.find((i) => i.id === id);
    if (!cur) return;
    const text = raw.replace(/ /g, ' ').replace(/^\n+/, '').replace(/\s+$/, '');
    if (!text.trim() && itemKind(cur) === 'text') {
      // An emptied box goes away. A brand-new empty box leaves no trace in undo.
      commitItems(
        (items) => items.filter((i) => i.id !== id),
        !(snap && snap.isNew),
      );
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      return;
    }
    if (!text.trim()) {
      if (snap && snap.isNew) pushHistory(b.id, snap.items);
      if (text !== cur.text) {
        commitItems(
          (items) =>
            items.map((i) =>
              i.id === id ? { ...i, text: '', editedAt: nowISO() } : i,
            ),
          !(snap && snap.isNew),
        );
      }
      return;
    }
    if (text === cur.text) return;
    const edited = (items: Item[]) =>
      items.map((i) => (i.id === id ? { ...i, text, editedAt: nowISO() } : i));
    if (snap && snap.isNew) {
      pushHistory(b.id, snap.items);
      commitItems(edited, false);
    } else {
      commitItems(edited, true);
    }
  };

  const moveItems = (ids: string[], dx: number, dy: number) => {
    const set = new Set(ids);
    commitItems((items) =>
      items.map((i) => {
        if (!set.has(i.id)) return i;
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
      }),
    );
  };

  const resizeItem = (id: string, box: Rect, handle: Handle) => {
    commitItems((items) =>
      items.map((i) => {
        if (i.id !== id) return i;
        const x = Math.round(box.x);
        const y = Math.round(box.y);
        const w = Math.round(box.w);
        const h = Math.round(box.h);
        const kind = itemKind(i);
        if (kind === 'shape') return { ...i, x, y, w, h };
        if (kind === 'sticky') {
          return handle.length === 2 ? { ...i, x, y, w, h } : { ...i, x, y, w };
        }
        return { ...i, x, w };
      }),
    );
  };

  const patchItem = (id: string, patch: Partial<Item>) => {
    commitItems((items) =>
      items.map((i) => {
        if (i.id !== id) return i;
        const next = compactItem({ ...i, ...patch, editedAt: nowISO() });
        if (next.fill && next.fill !== 'none' && itemKind(next) === 'sticky')
          setStickyFill(next.fill);
        return next;
      }),
    );
  };

  const deleteSelected = () => {
    const sel = selectedRef.current;
    if (!sel.size) return;
    commitItems((items) => {
      const rects = nodeRects(items);
      return items
        .filter((i) => !sel.has(i.id))
        .map((i) => {
          if (itemKind(i) !== 'connector') return i;
          return compactItem({
            ...i,
            start: detachAnchor(i.start, sel, rects),
            end: detachAnchor(i.end, sel, rects),
          });
        });
    });
    setSelected(new Set());
  };

  const undo = () => {
    const b = currentBoard();
    if (!b) return;
    const h = hist(b.id);
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(b.items);
    h.coalesceKey = undefined;
    h.at = undefined;
    commitItems(() => prev, false);
    setEditingId(null);
    setSelected(
      (s) =>
        new Set(Array.from(s).filter((id) => prev.some((i) => i.id === id))),
    );
  };

  const redo = () => {
    const b = currentBoard();
    if (!b) return;
    const h = hist(b.id);
    const next = h.future.pop();
    if (!next) return;
    h.past.push(b.items);
    h.coalesceKey = undefined;
    h.at = undefined;
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
      const rects = sel
        .map((id) => api.rectOf(id))
        .filter((r): r is NonNullable<typeof r> => !!r);
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
    void setCurrentRemote({ id: id as Id<'boards'> });
  };

  const createBoard = () => {
    void createRemote({}).then((b) => {
      setSelected(new Set());
      setEditingId(null);
      syncedAt.current.set(b.id, b.updatedAt);
      update((s) => ({ ...s, boards: [...s.boards, b], currentId: b.id }));
      setRenameOnOpen(true);
    });
  };

  const deleteBoard = (id: string) => {
    histories.current.delete(id);
    dirtyGens.current.delete(id);
    conflicted.current.delete(id);
    syncedAt.current.delete(id);
    update((s) => {
      const boards = s.boards.filter((b) => b.id !== id);
      if (!boards.length) return s;
      return {
        ...s,
        boards,
        currentId: s.currentId === id ? boards[0].id : s.currentId,
      };
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
    a.download = `${
      b.name
        .replace(/[^\w\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase() || 'board'
    }.margin.json`;
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
      syncedAt.current.set(b.id, b.updatedAt);
      update((s) => ({ ...s, boards: [...s.boards, b], currentId: b.id }));
      setSelected(new Set());
    });
    return null;
  };

  // ----- keyboard, paste, copy -----

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const actions = useRef({
    deleteSelected,
    undo,
    redo,
    createAt,
    dropPoint,
    startEdit,
  });
  actions.current = {
    deleteSelected,
    undo,
    redo,
    createAt,
    dropPoint,
    startEdit,
  };
  const askOpenRef = useRef(askOpen);
  askOpenRef.current = askOpen;
  const toolRef = useRef(tool);
  toolRef.current = tool;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'k') {
        e.preventDefault();
        setAskOpen((o) => !o);
        return;
      }
      if (isEditable(e.target) || e.defaultPrevented) return;
      const a = actions.current;
      if (e.key === 'Escape') {
        if (askOpenRef.current) setAskOpen(false);
        else if (toolRef.current.type !== 'select')
          setTool({ type: 'select' });
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
      } else if (key === 'v') {
        e.preventDefault();
        setTool({ type: 'select' });
      } else if (key === 't') {
        e.preventDefault();
        setTool({ type: 'text' });
      } else if (key === 's') {
        e.preventDefault();
        setTool({ type: 'sticky' });
      } else if (key === 'r') {
        e.preventDefault();
        setTool({ type: 'shape', shape: 'rect' });
      } else if (key === 'o') {
        e.preventDefault();
        setTool({ type: 'shape', shape: 'ellipse' });
      } else if (key === 'l') {
        e.preventDefault();
        setTool({ type: 'connector', route: 'straight' });
      } else if (key === 'x') {
        e.preventDefault();
        setTool({ type: 'connector', route: 'elbow' });
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
      a.createAt(
        { x: p.x - 8, y: p.y - 14 },
        text.replace(/\r\n/g, '\n').trim(),
      );
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
  const board =
    store.boards.find((b) => b.id === store.currentId) ?? store.boards[0];

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
        tool={tool}
        stickyFill={stickyFill}
        onSelect={setSelected}
        onMove={moveItems}
        onCreate={createItem}
        onResize={resizeItem}
        onPatch={patchItem}
        onEditStart={startEdit}
        onEditCommit={commitEdit}
        onViewChange={(v: View) => patchBoard(board.id, { view: v })}
        onZoom={setZoom}
      />

      {board.items.length === 0 && !editingId && (
        <div
          className="pointer-events-none fixed top-[42%] left-1/2 w-full -translate-x-1/2 -translate-y-1/2 px-4 text-center"
          aria-hidden="true">
          <p className="m-0  text-[22px] leading-snug font-normal text-zinc-500 italic">
            Double-click anywhere to write.
          </p>
          <p className="mt-2 font-mono text-xs font-normal text-zinc-400">
            Paste to drop text in &middot; &#8984;K to ask
          </p>
        </div>
      )}

      <BoardSwitcher
        boards={store.boards}
        currentId={board.id}
        startRenaming={renameOnOpen}
        onSwitch={switchBoard}
        onCreate={createBoard}
        onRename={(id, name) => {
          patchBoard(id, { name, updatedAt: nowISO() });
          setRenameOnOpen(false);
        }}
        onDelete={deleteBoard}
        onExport={exportBoard}
        onImport={importBoard}
      />

      <SaveStatus status={saveStatus} />

      <UserMenu user={user} />

      <CanvasToolbar
        zoom={zoom}
        askOpen={askOpen}
        tool={tool}
        onTool={setTool}
        onAsk={() => setAskOpen((o) => !o)}
        onFit={() => canvasApi.current?.fit()}
      />

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
    </div>
  );
}
