'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type {
  AskTurn,
  Author,
  Board,
  Handle,
  Item,
  Side,
  Store,
  Tool,
  User,
  View,
} from '@/lib/types';
import { FORMAT_EVENT, wrapSelection, type FormatKind } from '@/lib/format';
import { boardSize, encodeWebp, uploadAsset } from '@/lib/images';
import { exportJSON, nowISO, parseImport, uid } from '@/lib/store';
import {
  compactItem,
  isBox,
  itemKind,
  scaleItem,
  SHAPE_SIZE,
  STICKY_SIZE,
  STICKY_WIDE,
  storedRect,
  styleOf,
  type ItemStyle,
  type Rect,
} from '@/lib/items';
import {
  detachAnchor,
  nodeRects,
  oppositeSide,
  quickCreateOrigin,
} from '@/lib/connectors';
import { nextHistory } from '@/lib/history';
import {
  cloneItems,
  decodeItems,
  encodeItems,
  MARGIN_ITEMS_MIME,
  shiftItem,
  unionBounds,
} from '@/lib/clipboard';
import { arrangeItems, GRID, type ArrangeOp } from '@/lib/align';
import { restack, unlockedIds, type RestackDir } from '@/lib/stack';
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
  const [snapGrid, setSnapGrid] = useState(false);
  const [tool, setTool] = useState<Tool>({ type: 'select' });
  const [stickyStyle, setStickyStyle] = useState<ItemStyle>({ fill: 'amber' });
  const [shapeStyle, setShapeStyle] = useState<ItemStyle>({ fill: 'white' });
  const [textStyle, setTextStyle] = useState<ItemStyle>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  const previewBlobs = useRef(new Map<string, Blob>());
  const uploads = useRef(new Map<string, Promise<string>>());
  const copiedStyle = useRef<ItemStyle | null>(null);
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
  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const saveAsset = useMutation(api.assets.save);
  const assetIds = [
    ...new Set(
      (store?.boards.find((b) => b.id === store.currentId)?.items ?? [])
        .map((i) => i.assetId)
        .filter((id): id is string => !!id),
    ),
  ];
  const remoteUrls = useQuery(
    api.assets.urls,
    isAuthenticated && assetIds.length
      ? { ids: assetIds as Id<'_storage'>[] }
      : 'skip',
  );

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
    const items = store?.boards.find((b) => b.id === store.currentId)?.items ?? [];
    setPreviews((p) => {
      const next: Record<string, string> = {};
      for (const [id, url] of Object.entries(p)) {
        const it = items.find((i) => i.id === id);
        if (!it) continue;
        if (it.assetId && remoteUrls?.[it.assetId]) continue;
        next[id] = url;
      }
      for (const url of new Set(Object.values(p))) {
        if (!Object.values(next).includes(url)) URL.revokeObjectURL(url);
      }
      return Object.keys(next).length === Object.keys(p).length ? p : next;
    });
  }, [store, remoteUrls]);

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

  const rememberStyle = (next: Item) => {
    const k = itemKind(next);
    const style = styleOf(next);
    if (k === 'sticky') setStickyStyle((s) => ({ ...s, ...style }));
    else if (k === 'shape') setShapeStyle((s) => ({ ...s, ...style }));
    else if (k === 'text') setTextStyle((s) => ({ ...s, ...style }));
  };

  const lastFor = (kind: Item['kind']) =>
    kind === 'sticky' ? stickyStyle : kind === 'shape' ? shapeStyle : textStyle;

  const createItem = (draft: CreateDraft) => {
    const b = currentBoard();
    if (!b) return '';
    const t = nowISO();
    const kind = draft.kind ?? 'text';
    const last = lastFor(kind);
    const boxKind = kind === 'text' || kind === 'sticky' || kind === 'shape';
    const media =
      kind === 'image' || kind === 'link' || kind === 'embed';
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
      fill: draft.fill ?? (kind === 'sticky' || kind === 'shape' ? last.fill : undefined),
      stroke: draft.stroke ?? (kind === 'shape' ? last.stroke : undefined),
      strokeWidth:
        draft.strokeWidth ?? (kind === 'shape' ? last.strokeWidth : undefined),
      strokeStyle:
        draft.strokeStyle ?? (kind === 'shape' ? last.strokeStyle : undefined),
      textColor: boxKind ? (draft.textColor ?? last.textColor) : undefined,
      fontSize: boxKind ? (draft.fontSize ?? last.fontSize) : undefined,
      align: boxKind ? (draft.align ?? last.align) : undefined,
      route: draft.route,
      start: draft.start,
      end: draft.end,
      assetId: draft.assetId,
      caption: draft.caption,
    });
    rememberStyle(item);
    const startEdit =
      draft.edit === true ||
      (draft.edit !== false && kind !== 'connector' && !media && !item.text);
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

  const persistPreview = (previewUrl: string) => {
    let job = uploads.current.get(previewUrl);
    if (!job) {
      job = (async () => {
        const blob = previewBlobs.current.get(previewUrl);
        if (!blob) throw new Error('Upload failed');
        const postUrl = await generateUploadUrl();
        const storageId = await uploadAsset(blob, postUrl);
        await saveAsset({ storageId: storageId as Id<'_storage'> });
        return storageId;
      })();
      uploads.current.set(previewUrl, job);
    }
    void job.then(
      (storageId) => {
        const ids = Object.entries(previewsRef.current)
          .filter(([, url]) => url === previewUrl)
          .map(([id]) => id);
        commitItems(
          (items) =>
            items.map((i) =>
              ids.includes(i.id) && !i.assetId
                ? compactItem({ ...i, assetId: storageId, editedAt: nowISO() })
                : i,
            ),
          false,
        );
        previewBlobs.current.delete(previewUrl);
        uploads.current.delete(previewUrl);
      },
      () => {
        uploads.current.delete(previewUrl);
        toast.add({
          type: 'error',
          title: 'Couldn’t upload that image',
          actionProps: {
            children: 'Retry',
            onClick: () => persistPreview(previewUrl),
          },
        });
      },
    );
  };

  const addImageAt = async (file: File, at: Pt) => {
    if (!file.type.startsWith('image/')) return;
    let encoded: { blob: Blob; w: number; h: number };
    try {
      encoded = await encodeWebp(file);
    } catch {
      toast.add({ type: 'error', title: 'Couldn’t read that image' });
      return;
    }
    const size = boardSize(encoded.w, encoded.h);
    const preview = URL.createObjectURL(encoded.blob);
    const id = createItem({
      kind: 'image',
      x: at.x,
      y: at.y,
      w: size.w,
      h: size.h,
      edit: false,
    });
    if (!id) {
      URL.revokeObjectURL(preview);
      return;
    }
    previewBlobs.current.set(preview, encoded.blob);
    previewsRef.current = { ...previewsRef.current, [id]: preview };
    setPreviews(previewsRef.current);
    persistPreview(preview);
  };

  const addImages = (files: File[], at: Pt) => {
    void (async () => {
      for (let i = 0; i < files.length; i++) {
        await addImageAt(files[i], { x: at.x + i * 24, y: at.y + i * 24 });
      }
    })();
  };

  const quickCreate = (sourceId: string, side: Side) => {
    const b = currentBoard();
    if (!b) return;
    const src = b.items.find((i) => i.id === sourceId);
    if (!src) return;
    const kind = itemKind(src);
    if (kind !== 'sticky' && kind !== 'shape') return;
    const from = storedRect(src);
    const size =
      kind === 'sticky'
        ? { w: src.w ?? STICKY_SIZE, h: src.h ?? STICKY_SIZE }
        : { w: src.w ?? SHAPE_SIZE, h: src.h ?? SHAPE_SIZE };
    const origin = quickCreateOrigin(from, side, size);
    const t = nowISO();
    const style = styleOf(src);
    const next = compactItem({
      id: uid(kind[0] + '_'),
      x: Math.round(origin.x),
      y: Math.round(origin.y),
      w: size.w,
      h: size.h,
      text: '',
      by: 'me',
      createdAt: t,
      editedAt: t,
      kind,
      shape: src.shape,
      fill: src.fill ?? style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      strokeStyle: style.strokeStyle,
      textColor: style.textColor,
      fontSize: style.fontSize,
      align: style.align,
    });
    const line = compactItem({
      id: uid('c_'),
      x: 0,
      y: 0,
      text: '',
      by: 'me',
      createdAt: t,
      editedAt: t,
      kind: 'connector',
      start: { itemId: src.id, side },
      end: { itemId: next.id, side: oppositeSide(side) },
    });
    rememberStyle(next);
    editSnapshot.current = { id: next.id, items: b.items, isNew: true };
    commitItems((items) => [...items, next, line], false);
    setSelected(new Set([next.id]));
    setEditingId(next.id);
  };

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
    if (itemKind(cur) === 'image') {
      const caption = text.trim() || undefined;
      if ((cur.caption ?? '') === (caption ?? '')) return;
      const edited = (items: Item[]) =>
        items.map((i) =>
          i.id === id
            ? compactItem({ ...i, caption, editedAt: nowISO() })
            : i,
        );
      if (snap && snap.isNew) {
        pushHistory(b.id, snap.items);
        commitItems(edited, false);
      } else {
        commitItems(edited, true);
      }
      return;
    }
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

  const moveItems = (ids: string[], dx: number, dy: number, coalesceKey?: string) => {
    const set = new Set(ids);
    commitItems(
      (items) => items.map((i) => (set.has(i.id) ? shiftItem(i, dx, dy) : i)),
      true,
      coalesceKey,
    );
  };

  const duplicateItems = (ids: string[], dx: number, dy: number) => {
    const b = currentBoard();
    if (!b || !ids.length) return;
    const set = new Set(ids);
    const source = b.items.filter((i) => set.has(i.id));
    const copies = cloneItems(source, b.items).map((i) => shiftItem(i, dx, dy));
    setPreviews((p) => {
      const next = { ...p };
      source.forEach((s, i) => {
        const copy = copies[i];
        if (p[s.id] && copy && !copy.assetId) next[copy.id] = p[s.id];
      });
      return next;
    });
    commitItems((items) => [...items, ...copies]);
    setSelected(new Set(copies.map((i) => i.id)));
  };

  const duplicateSelected = () => {
    const k = zoomRef.current || 1;
    const offset = 16 / k;
    duplicateItems(Array.from(selectedRef.current), offset, offset);
  };

  const nudgeSelected = (dx: number, dy: number) => {
    const b = currentBoard();
    if (!b) return;
    const ids = unlockedIds(b.items, selectedRef.current);
    if (!ids.length) return;
    moveItems(ids, dx, dy, 'nudge');
  };

  const restackSelected = (dir: RestackDir) => {
    const sel = selectedRef.current;
    if (!sel.size) return;
    commitItems((items) => restack(items, sel, dir));
  };

  const toggleLockSelected = () => {
    const sel = selectedRef.current;
    if (!sel.size) return;
    commitItems((items) => {
      const picked = items.filter((i) => sel.has(i.id));
      const nextLocked = !picked.every((i) => i.locked);
      return items.map((i) =>
        sel.has(i.id)
          ? compactItem({
              ...i,
              locked: nextLocked ? true : undefined,
              editedAt: nowISO(),
            })
          : i,
      );
    });
  };

  const groupSelected = () => {
    const sel = selectedRef.current;
    if (sel.size < 2) return;
    const gid = uid('g_');
    commitItems((items) =>
      items.map((i) =>
        sel.has(i.id) ? compactItem({ ...i, groupId: gid }) : i,
      ),
    );
  };

  const ungroupSelected = () => {
    const sel = selectedRef.current;
    if (!sel.size) return;
    commitItems((items) =>
      items.map((i) => {
        if (!sel.has(i.id) || !i.groupId) return i;
        const next = { ...i };
        delete next.groupId;
        return compactItem(next);
      }),
    );
  };

  const pasteItems = (source: Item[]) => {
    const b = currentBoard();
    if (!b || !source.length) return;
    const copies = cloneItems(source, source);
    const box = unionBounds(copies);
    const api = canvasApi.current;
    const p = api?.pointer() ?? api?.center() ?? { x: 0, y: 0 };
    const dx = box ? p.x - (box.x + box.w / 2) : p.x;
    const dy = box ? p.y - (box.y + box.h / 2) : p.y;
    const placed = copies.map((i) => shiftItem(i, dx, dy));
    commitItems((items) => [...items, ...placed]);
    setSelected(new Set(placed.map((i) => i.id)));
  };

  const writeSelection = (data: DataTransfer): boolean => {
    const b = currentBoard();
    const sel = selectedRef.current;
    if (!b || !sel.size) return false;
    const picked = b.items.filter((i) => sel.has(i.id));
    const text = [...picked]
      .sort((x, y) => x.y - y.y || x.x - y.x)
      .map((i) => i.text)
      .join('\n\n');
    data.setData('text/plain', text);
    data.setData(MARGIN_ITEMS_MIME, encodeItems(cloneItems(picked, b.items)));
    return true;
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
        if (
          kind === 'shape' ||
          kind === 'image' ||
          kind === 'link' ||
          kind === 'embed'
        )
          return { ...i, x, y, w, h };
        if (kind === 'sticky') {
          return handle.length === 2 ? { ...i, x, y, w, h } : { ...i, x, y, w };
        }
        return { ...i, x, w };
      }),
    );
  };

  const resizeAll = (ids: string[], from: Rect, to: Rect) => {
    const set = new Set(ids);
    commitItems((items) =>
      items.map((i) => (set.has(i.id) ? scaleItem(i, from, to) : i)),
    );
  };

  const patchItem = (id: string, patch: Partial<Item>, coalesceKey?: string) => {
    commitItems(
      (items) =>
        items.map((i) => {
          if (i.id !== id) return i;
          const next = compactItem({ ...i, ...patch, editedAt: nowISO() });
          rememberStyle(next);
          return next;
        }),
      true,
      coalesceKey,
    );
  };

  const patchSelected = (patch: Partial<Item>, coalesceKey?: string) => {
    const sel = selectedRef.current;
    if (!sel.size) return;
    commitItems(
      (items) =>
        items.map((i) => {
          if (!sel.has(i.id)) return i;
          const kind = itemKind(i);
          if (patch.fill && kind !== 'sticky' && kind !== 'shape') return i;
          if (patch.fill === 'none' && kind === 'sticky') return i;
          if (
            (patch.stroke !== undefined ||
              patch.strokeWidth !== undefined ||
              patch.strokeStyle !== undefined) &&
            kind !== 'shape'
          )
            return i;
          if (
            patch.textColor &&
            kind !== 'text' &&
            kind !== 'sticky' &&
            kind !== 'shape'
          )
            return i;
          if (patch.route && kind !== 'connector') return i;
          if (
            (patch.arrowStart !== undefined ||
              patch.arrowEnd !== undefined ||
              patch.bend !== undefined) &&
            kind !== 'connector'
          )
            return i;
          if (
            (patch.fontSize !== undefined || patch.align !== undefined) &&
            !isBox(i)
          )
            return i;
          if (patch.w === STICKY_WIDE && patch.h === undefined && kind !== 'sticky')
            return i;
          if (patch.caption !== undefined && kind !== 'image') return i;
          const next = compactItem({ ...i, ...patch, editedAt: nowISO() });
          rememberStyle(next);
          return next;
        }),
      true,
      coalesceKey,
    );
  };

  const formatSelected = (kind: FormatKind) => {
    if (editingId) {
      window.dispatchEvent(new CustomEvent(FORMAT_EVENT, { detail: kind }));
      return;
    }
    const sel = selectedRef.current;
    if (!sel.size) return;
    commitItems(
      (items) =>
        items.map((i) => {
          if (!sel.has(i.id) || !isBox(i)) return i;
          const k = itemKind(i);
          if (k === 'image' || k === 'link' || k === 'embed') return i;
          const next = wrapSelection(i.text, 0, i.text.length, kind);
          return compactItem({ ...i, text: next.text, editedAt: nowISO() });
        }),
      true,
      'format',
    );
  };

  const copyStyleSelected = () => {
    const b = currentBoard();
    const sel = selectedRef.current;
    if (!b || !sel.size) return;
    const first = b.items.find((i) => sel.has(i.id) && isBox(i));
    if (!first) return;
    copiedStyle.current = styleOf(first);
  };

  const pasteStyleSelected = () => {
    if (!copiedStyle.current) return;
    patchSelected(copiedStyle.current, 'style');
  };

  const arrangeSelected = (op: ArrangeOp) => {
    const sel = selectedRef.current;
    if (!sel.size) return;
    commitItems((items) => arrangeItems(items, sel, op));
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
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const snapGridRef = useRef(snapGrid);
  snapGridRef.current = snapGrid;
  const actions = useRef({
    deleteSelected,
    undo,
    redo,
    createAt,
    dropPoint,
    startEdit,
    duplicateSelected,
    nudgeSelected,
    pasteItems,
    writeSelection,
    addImages,
    restackSelected,
    toggleLockSelected,
    groupSelected,
    ungroupSelected,
    copyStyleSelected,
    pasteStyleSelected,
  });
  actions.current = {
    deleteSelected,
    undo,
    redo,
    createAt,
    dropPoint,
    startEdit,
    duplicateSelected,
    nudgeSelected,
    pasteItems,
    writeSelection,
    addImages,
    restackSelected,
    toggleLockSelected,
    groupSelected,
    ungroupSelected,
    copyStyleSelected,
    pasteStyleSelected,
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
      if (mod && key === 'd') {
        e.preventDefault();
        a.duplicateSelected();
        return;
      }
      if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) {
        e.preventDefault();
        a.restackSelected(
          e.code === 'BracketRight'
            ? e.shiftKey
              ? 'front'
              : 'forward'
            : e.shiftKey
              ? 'backmost'
              : 'back',
        );
        return;
      }
      if (mod && e.shiftKey && key === 'l') {
        e.preventDefault();
        a.toggleLockSelected();
        return;
      }
      if (mod && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) a.ungroupSelected();
        else a.groupSelected();
        return;
      }
      if (mod && e.altKey && key === 'c') {
        e.preventDefault();
        a.copyStyleSelected();
        return;
      }
      if (mod && e.altKey && key === 'v') {
        e.preventDefault();
        a.pasteStyleSelected();
        return;
      }
      if (mod || e.altKey) return;
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        if (!selectedRef.current.size) return;
        e.preventDefault();
        const step = snapGridRef.current
          ? e.shiftKey
            ? GRID * 10
            : GRID
          : (e.shiftKey ? 10 : 1) / (zoomRef.current || 1);
        const dx =
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy =
          e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        a.nudgeSelected(dx, dy);
        return;
      }
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

    // Paste items (custom MIME) or plain text as a box.
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const data = e.clipboardData;
      if (!data) return;
      const a = actions.current;
      const raw = data.getData(MARGIN_ITEMS_MIME);
      if (raw) {
        const source = decodeItems(raw);
        if (source?.length) {
          e.preventDefault();
          a.pasteItems(source);
          return;
        }
      }
      const image =
        [...data.items].find((it) => it.type.startsWith('image/')) ?? null;
      const imageFile = image?.getAsFile() ?? data.files[0] ?? null;
      if (imageFile && imageFile.type.startsWith('image/')) {
        e.preventDefault();
        a.addImages([imageFile], a.dropPoint());
        return;
      }
      const text = data.getData('text/plain');
      if (!text.trim()) return;
      e.preventDefault();
      const p = a.dropPoint();
      a.createAt(
        { x: p.x - 8, y: p.y - 14 },
        text.replace(/\r\n/g, '\n').trim(),
      );
    };

    // Copy selected boxes as Margin JSON plus plain text.
    const onCopy = (e: ClipboardEvent) => {
      if (isEditable(e.target) || !e.clipboardData) return;
      if (!actions.current.writeSelection(e.clipboardData)) return;
      e.preventDefault();
    };

    const onCut = (e: ClipboardEvent) => {
      if (isEditable(e.target) || !e.clipboardData) return;
      if (!actions.current.writeSelection(e.clipboardData)) return;
      e.preventDefault();
      actions.current.deleteSelected();
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
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
        stickyStyle={stickyStyle}
        shapeStyle={shapeStyle}
        textStyle={textStyle}
        onSelect={setSelected}
        onMove={moveItems}
        onDuplicateMove={duplicateItems}
        onCreate={createItem}
        onQuickCreate={quickCreate}
        onResize={resizeItem}
        onResizeAll={resizeAll}
        onPatch={patchItem}
        onPatchAll={patchSelected}
        onToggleLock={toggleLockSelected}
        onArrange={arrangeSelected}
        onFormat={formatSelected}
        snapGrid={snapGrid}
        onEditStart={startEdit}
        onEditCommit={commitEdit}
        onViewChange={(v: View) => patchBoard(board.id, { view: v })}
        onZoom={setZoom}
        assetUrls={{ ...(remoteUrls ?? {}), ...previews }}
        onDropImages={addImages}
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
        snapGrid={snapGrid}
        onSnapGrid={setSnapGrid}
        onPickImages={(files) => addImages(files, dropPoint())}
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
