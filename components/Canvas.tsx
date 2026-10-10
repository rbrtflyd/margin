'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import type {
  Anchor,
  Arrowhead,
  Handle,
  Item,
  Side,
  Tool,
  View,
} from '@/lib/types';
import {
  boundsOf,
  forgetSize,
  isBox,
  itemKind,
  mapPoint,
  rememberSize,
  storedRect,
  unionRect,
  type ItemStyle,
  type Rect,
} from '@/lib/items';
import {
  alongPath,
  arrowEndOf,
  arrowHead,
  arrowStartOf,
  arrowTriangle,
  connectorPoints,
  elbowMid,
  isAttach,
  itemConnectorPoints,
  outPoint,
  pathD,
  pathDGapped,
  PLUS_OUT,
  resolveEnds,
  SIDES,
  sidePoint,
  type Pt,
} from '@/lib/connectors';
import BoardItem, { BOX_HANDLES, Editor, HANDLE_POS } from './BoardItem';
import SelectionBar from './SelectionBar';
import type { ArrangeOp, Guides } from '@/lib/align';
import type { FormatKind } from '@/lib/format';
import type {
  CreateDraft,
  Drag,
  InteractionCtx,
  ResizeLive,
} from './canvas/types';
import { isEditable } from './canvas/types';
import { liveRects } from './canvas/liveRects';
import { startPan } from './canvas/pan';
import { startMove } from './canvas/move';
import { startMarquee } from './canvas/marquee';
import { startResize } from './canvas/resize';
import { placeShape, placeSticky, startPlace } from './canvas/place';
import { startConnect, startConnectFrom } from './canvas/connect';
import { startBend } from './canvas/bend';
import { startLabel } from './canvas/label';
import { startEndpoint } from './canvas/endpoint';
import { endDrag, moveDrag } from './canvas/index';

export type { Pt, Rect, CreateDraft };

/** What the rest of the app can ask of the canvas. */
export interface CanvasApi {
  center(): Pt;
  pointer(): Pt | null;
  fit(): void;
  zoomTo(k: number): void;
  rectOf(id: string): Rect | null;
  panTo(p: Pt): void;
}

interface Props {
  items: Item[];
  initialView: View | null;
  selected: Set<string>;
  editingId: string | null;
  flash: string[];
  tool: Tool;
  stickyStyle: ItemStyle;
  shapeStyle: ItemStyle;
  textStyle: ItemStyle;
  apiRef: RefObject<CanvasApi | null>;
  onSelect(ids: Set<string>): void;
  onMove(ids: string[], dx: number, dy: number): void;
  onDuplicateMove(ids: string[], dx: number, dy: number): void;
  onCreate(draft: CreateDraft): void;
  onQuickCreate(sourceId: string, side: Side): void;
  onResize(id: string, box: Rect, handle: Handle): void;
  onResizeAll(ids: string[], from: Rect, to: Rect): void;
  onPatch(id: string, patch: Partial<Item>, coalesceKey?: string): void;
  onPatchAll(patch: Partial<Item>, coalesceKey?: string): void;
  onToggleLock(): void;
  onArrange(op: ArrangeOp): void;
  onFormat(kind: FormatKind): void;
  snapGrid: boolean;
  onEditStart(id: string): void;
  onEditCommit(id: string, text: string): void;
  onViewChange(v: View): void;
  onZoom(k: number): void;
  assetUrls?: Record<string, string>;
  onDropImages(files: File[], at: Pt): void;
}

function ArrowMark({
  kind,
  from,
  to,
  color,
}: {
  kind: Arrowhead;
  from: Pt;
  to: Pt;
  color: string;
}) {
  if (kind === 'none') return null;
  if (kind === 'circle') {
    return (
      <circle
        cx={to.x}
        cy={to.y}
        r={4}
        fill={color}
        className="pointer-events-none"
      />
    );
  }
  if (kind === 'triangle') {
    return (
      <path
        d={arrowTriangle(from, to)}
        fill={color}
        className="pointer-events-none"
      />
    );
  }
  return (
    <path
      d={arrowHead(from, to)}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      className="pointer-events-none"
    />
  );
}

const MIN_K = 0.1;
const MAX_K = 4;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

export default function Canvas(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(
    props.initialView ?? { x: 0, y: 0, k: 1 },
  );
  const viewRef = useRef(view);
  viewRef.current = view;
  const propsRef = useRef(props);
  propsRef.current = props;

  const [dragging, setDragging] = useState<{
    ids: Set<string>;
    x: number;
    y: number;
  } | null>(null);
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;
  const [marquee, setMarquee] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const [preview, setPreview] = useState<Set<string> | null>(null);
  const previewRef = useRef<Set<string> | null>(null);
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const spaceRef = useRef(false);
  const [placeBox, setPlaceBox] = useState<Rect | null>(null);
  const [draftLine, setDraftLine] = useState<{
    start: Anchor;
    end: Anchor;
  } | null>(null);
  const [resize, setResize] = useState<ResizeLive | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guides | null>(null);
  const resizeRef = useRef(resize);
  resizeRef.current = resize;
  const [endDraft, setEndDraft] = useState<{
    id: string;
    which: 'start' | 'end';
    anchor: Anchor;
  } | null>(null);

  const dragRef = useRef<Drag | null>(null);
  const labelSize = useRef(new Map<string, { w: number; h: number }>());
  const [, setLabelTick] = useState(0);
  const els = useRef(new Map<string, Element>());
  const [, setMeasureTick] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  if (!roRef.current && typeof ResizeObserver !== 'undefined') {
    roRef.current = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const el = entry.target;
        if (!(el instanceof HTMLElement)) continue;
        const id = el.dataset.item;
        if (!id) continue;
        if (rememberSize(id, el.offsetWidth, el.offsetHeight)) changed = true;
      }
      if (changed) setMeasureTick((n) => n + 1);
    });
  }

  function watchEl(id: string, el: Element | null) {
    const ro = roRef.current;
    const prev = els.current.get(id);
    if (prev && ro) ro.unobserve(prev);
    if (el) {
      els.current.set(id, el);
      if (el instanceof HTMLElement) {
        rememberSize(id, el.offsetWidth, el.offsetHeight);
        ro?.observe(el);
      }
    } else {
      els.current.delete(id);
      forgetSize(id);
    }
  }

  function watchLabel(id: string, el: HTMLDivElement | null) {
    if (!el) {
      labelSize.current.delete(id);
      return;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const prev = labelSize.current.get(id);
    if (!prev || prev.w !== w || prev.h !== h) {
      labelSize.current.set(id, { w, h });
      queueMicrotask(() => setLabelTick((n) => n + 1));
    }
  }
  const pointerWorld = useRef<Pt | null>(null);
  const touches = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d0: number; k0: number } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const ctxRef = useRef<InteractionCtx>(null as unknown as InteractionCtx);

  function rootRect(): DOMRect | null {
    return rootRef.current ? rootRef.current.getBoundingClientRect() : null;
  }

  function toWorld(clientX: number, clientY: number): Pt {
    const r = rootRect();
    const v = viewRef.current;
    const left = r ? r.left : 0;
    const top = r ? r.top : 0;
    return { x: (clientX - left - v.x) / v.k, y: (clientY - top - v.y) / v.k };
  }

  function zoomAt(px: number, py: number, factor: number) {
    setView((v) => {
      const k = clampK(v.k * factor);
      return {
        k,
        x: px - (px - v.x) * (k / v.k),
        y: py - (py - v.y) * (k / v.k),
      };
    });
  }

  function currentRects() {
    return liveRects(
      propsRef.current.items,
      draggingRef.current,
      resizeRef.current,
    );
  }

  ctxRef.current = {
    viewRef,
    propsRef: propsRef as InteractionCtx['propsRef'],
    dragRef,
    els,
    previewRef,
    lastTap,
    setView,
    setDragging,
    setPanning,
    setPlaceBox,
    setDraftLine,
    setResize,
    setEndDraft,
    setMarquee,
    setPreview,
    setGuides,
    toWorld,
    currentRects,
    rootRect,
    activateEmbed: (id) => setActiveEmbedId(id),
  };

  function fitTo(items: Item[]) {
    const r = rootRect();
    if (!r) return;
    if (!items.length) {
      setView({ x: r.width / 2 - 140, y: r.height * 0.4, k: 1 });
      return;
    }
    const rects = liveRects(items, null, null);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const it of items) {
      if (itemKind(it) === 'connector') {
        const pts = itemConnectorPoints(it, rects);
        for (const p of pts) {
          x0 = Math.min(x0, p.x);
          y0 = Math.min(y0, p.y);
          x1 = Math.max(x1, p.x);
          y1 = Math.max(y1, p.y);
        }
        continue;
      }
      if (!isBox(it)) continue;
      const box = rects.get(it.id);
      const w = box ? box.w : 240;
      const h = box ? box.h : 40;
      x0 = Math.min(x0, it.x);
      y0 = Math.min(y0, it.y);
      x1 = Math.max(x1, it.x + w);
      y1 = Math.max(y1, it.y + h);
    }
    if (!Number.isFinite(x0)) {
      setView({ x: r.width / 2 - 140, y: r.height * 0.4, k: 1 });
      return;
    }
    const pad = 80;
    const k = clampK(
      Math.min(
        1,
        (r.width - pad * 2) / Math.max(1, x1 - x0),
        (r.height - pad * 2 - 60) / Math.max(1, y1 - y0),
      ),
    );
    setView({
      k,
      x: (r.width - (x1 - x0) * k) / 2 - x0 * k,
      y: (r.height - 60 - (y1 - y0) * k) / 2 - y0 * k,
    });
  }

  useLayoutEffect(() => {
    if (!props.initialView) fitTo(props.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => propsRef.current.onViewChange(view), 300);
    return () => clearTimeout(t);
  }, [view]);
  useEffect(() => {
    propsRef.current.onZoom(view.k);
  }, [view.k]);

  useEffect(() => {
    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api: CanvasApi = {
      center: () => {
        const r = rootRect();
        const v = viewRef.current;
        return r
          ? { x: (r.width / 2 - v.x) / v.k, y: (r.height / 2 - v.y) / v.k }
          : { x: 0, y: 0 };
      },
      pointer: () => pointerWorld.current,
      fit: () => fitTo(propsRef.current.items),
      zoomTo: (k: number) => {
        const r = rootRect();
        if (r) zoomAt(r.width / 2, r.height / 2, k / viewRef.current.k);
      },
      rectOf: (id: string) => {
        const it = propsRef.current.items.find((i) => i.id === id);
        if (!it) return null;
        if (itemKind(it) === 'connector') {
          const rects = liveRects(propsRef.current.items, null, null);
          const mid = alongPath(
            itemConnectorPoints(it, rects),
            it.labelAt ?? 0.5,
          );
          return { x: mid.x, y: mid.y, w: 0, h: 0 };
        }
        return boundsOf(it);
      },
      panTo: (p: Pt) => {
        const r = rootRect();
        if (!r) return;
        setView((v) => ({
          ...v,
          x: r.width / 2 - p.x * v.k,
          y: r.height / 2 - p.y * v.k,
        }));
      },
    };
    const ref = props.apiRef;
    ref.current = api;
    return () => {
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (isEditable(e.target) && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(
          e.clientX - r.left,
          e.clientY - r.top,
          Math.exp(-e.deltaY * 0.01),
        );
      } else {
        const unit = e.deltaMode === 1 ? 16 : 1;
        const dx = e.deltaX * unit;
        const dy = e.deltaY * unit;
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    let lastScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & {
        scale: number;
        clientX: number;
        clientY: number;
      };
      const r = el.getBoundingClientRect();
      zoomAt(g.clientX - r.left, g.clientY - r.top, g.scale / lastScale);
      lastScale = g.scale;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveEmbedId(null);
      if (e.code === 'Space' && !isEditable(e.target) && !e.repeat) {
        e.preventDefault();
        spaceRef.current = true;
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false;
        setSpaceDown(false);
      }
    };
    const blur = () => {
      spaceRef.current = false;
      setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const ctx = ctxRef.current;
      const r = ctx.rootRect();
      if (
        r &&
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      ) {
        pointerWorld.current = ctx.toWorld(e.clientX, e.clientY);
      }
      if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && touches.current.size >= 2 && r) {
          const [a, b] = Array.from(touches.current.values());
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const k = clampK((pinch.current.k0 * d) / pinch.current.d0);
          zoomAt(
            (a.x + b.x) / 2 - r.left,
            (a.y + b.y) / 2 - r.top,
            k / viewRef.current.k,
          );
          return;
        }
      }
      const d = ctx.dragRef.current;
      if (!d) {
        const inside = !!(
          r &&
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        );
        if (!inside) {
          setHoverId(null);
          return;
        }
        const portEl = (e.target as HTMLElement | null)?.closest?.(
          '[data-dot],[data-plus]',
        );
        if (portEl instanceof HTMLElement && portEl.dataset.item) {
          setHoverId(portEl.dataset.item);
          return;
        }
        const w = ctx.toWorld(e.clientX, e.clientY);
        const items = ctx.propsRef.current.items;
        const selected = ctx.propsRef.current.selected;
        let hit: string | null = null;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (!isBox(it)) continue;
          const b = boundsOf(it);
          const pad = PLUS_OUT + 12;
          if (
            w.x >= b.x - pad &&
            w.x <= b.x + b.w + pad &&
            w.y >= b.y - pad &&
            w.y <= b.y + b.h + pad
          ) {
            hit = selected.has(it.id) ? null : it.id;
            break;
          }
        }
        setHoverId(hit);
        return;
      }
      const dx = e.clientX - ('sx' in d ? d.sx : 0);
      const dy = e.clientY - ('sy' in d ? d.sy : 0);
      if (!d.moved && Math.hypot(dx, dy) < 3 && d.kind !== 'connector' && d.kind !== 'endpoint')
        return;
      d.moved = true;
      setHoverId(null);
      moveDrag(ctx, d, e);
    };

    const up = (e: PointerEvent) => {
      const ctx = ctxRef.current;
      if (e.pointerType === 'touch') {
        touches.current.delete(e.pointerId);
        if (touches.current.size < 2) pinch.current = null;
      }
      const d = ctx.dragRef.current;
      if (!d) return;
      ctx.dragRef.current = null;
      ctx.setPanning(false);
      const p = ctx.propsRef.current;
      if (d.kind === 'pan' && !d.moved && e.pointerType === 'touch' && p.tool.type === 'select') {
        const now = Date.now();
        const last = ctx.lastTap.current;
        if (
          last &&
          now - last.t < 320 &&
          Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24
        ) {
          ctx.lastTap.current = null;
          const w = ctx.toWorld(e.clientX, e.clientY);
          p.onCreate({
            kind: 'text',
            x: w.x - 8,
            y: w.y - 14,
            text: '',
            edit: true,
          });
        } else {
          ctx.lastTap.current = { t: now, x: e.clientX, y: e.clientY };
          p.onSelect(new Set());
        }
        return;
      }
      endDrag(ctx, d, e);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onResizeDown(
    id: string,
    handle: Handle,
    e: ReactPointerEvent,
  ) {
    const next = startResize(ctxRef.current, [id], handle, e);
    if (next) dragRef.current = next;
  }

  function onUnionResizeDown(handle: Handle, e: ReactPointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const ids = Array.from(propsRef.current.selected);
    const next = startResize(ctxRef.current, ids, handle, e);
    if (next) dragRef.current = next;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (isEditable(e.target)) return;
    const ctx = ctxRef.current;
    const p = ctx.propsRef.current;
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-item]');
    if (activeEmbedId && hit?.dataset.item !== activeEmbedId) {
      setActiveEmbedId(null);
    }
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        const [a, b] = Array.from(touches.current.values());
        pinch.current = {
          d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          k0: viewRef.current.k,
        };
        dragRef.current = null;
        ctx.setDragging(null);
        return;
      }
    }
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    const endEl = target.closest<HTMLElement>('[data-end]');
    const itemEl = target.closest<HTMLElement>('[data-item]');
    const itemId = itemEl ? (itemEl.dataset.item ?? null) : null;
    const world = ctx.toWorld(e.clientX, e.clientY);

    if (
      e.button === 1 ||
      spaceRef.current ||
      (!itemId && e.pointerType === 'touch' && p.tool.type === 'select')
    ) {
      e.preventDefault();
      dragRef.current = startPan(ctx, e);
      return;
    }

    if (endEl && itemId) {
      dragRef.current = startEndpoint(
        itemId,
        endEl.dataset.end === 'start' ? 'start' : 'end',
      );
      return;
    }

    const bendEl = target.closest<HTMLElement>('[data-bend]');
    if (bendEl && itemId) {
      const it = p.items.find((i) => i.id === itemId);
      const axis = bendEl.dataset.bend === 'y' ? 'y' : 'x';
      dragRef.current = startBend(
        e.nativeEvent,
        itemId,
        axis,
        world,
        it?.bend ?? 0,
      );
      return;
    }

    const plusEl = target.closest<HTMLElement>('[data-plus]');
    if (plusEl && itemId) {
      const side = plusEl.dataset.plus as Side | undefined;
      if (side) props.onQuickCreate(itemId, side);
      return;
    }

    const dotEl = target.closest<HTMLElement>('[data-dot]');
    if (dotEl && itemId) {
      const side = dotEl.dataset.dot as Side | undefined;
      if (side) {
        dragRef.current = startConnectFrom({ itemId, side });
      }
      return;
    }

    const labelEl = target.closest<HTMLElement>('[data-label]');
    if (labelEl && itemId) {
      p.onSelect(new Set([itemId]));
      dragRef.current = startLabel(itemId);
      return;
    }

    if (p.tool.type === 'connector') {
      dragRef.current = startConnect(ctx, world);
      return;
    }

    if (!itemId && p.tool.type === 'text') {
      dragRef.current = startPlace(e, world);
      return;
    }

    if (!itemId && p.tool.type === 'sticky') {
      placeSticky(ctx, world);
      return;
    }

    if (!itemId && p.tool.type === 'shape') {
      placeShape(ctx, world, p.tool.shape);
      return;
    }

    if (itemId) {
      setHoverId(null);
      const next = startMove(ctx, e, itemId);
      if (next) dragRef.current = next;
      return;
    }

    dragRef.current = startMarquee(ctx, e);
  }

  function onDoubleClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (isEditable(e.target)) return;
    const p = propsRef.current;
    const target = e.target as HTMLElement;
    if (target.closest('[data-plus],[data-dot]')) return;
    const itemEl = target.closest<HTMLElement>('[data-item]');
    const id = itemEl ? itemEl.dataset.item : undefined;
    if (id) {
      const it = p.items.find((i) => i.id === id);
      const grouped =
        it?.groupId &&
        p.items.some(
          (i) => i.groupId === it.groupId && i.id !== id && p.selected.has(i.id),
        );
      if (grouped) {
        p.onSelect(new Set([id]));
        return;
      }
      const kind = it ? itemKind(it) : 'text';
      if (kind === 'link' || kind === 'embed') return;
      p.onEditStart(id);
      return;
    }
    if (p.tool.type !== 'select') return;
    const w = toWorld(e.clientX, e.clientY);
    p.onCreate({
      kind: 'text',
      x: w.x - 8,
      y: w.y - 14,
      text: '',
      edit: true,
    });
  }

  const shown = preview ?? props.selected;
  const flash = new Set(props.flash);
  const nodes = props.items.filter((it) => isBox(it));
  const lines = props.items.filter((it) => itemKind(it) === 'connector');
  const rects = liveRects(props.items, dragging, resize);
  const cursor =
    panning
      ? ' cursor-grabbing'
      : spaceDown
        ? ' cursor-grab'
        : props.tool.type === 'text'
          ? ' cursor-text'
          : props.tool.type !== 'select'
            ? ' cursor-crosshair'
            : '';

  const selectedItems = props.items.filter((i) => shown.has(i.id));
  const union = unionRect(
    selectedItems.filter(isBox).map((i) => rects.get(i.id) ?? storedRect(i)),
  );
  let barLeft = 0;
  let barTop = 0;
  if (shown.size) {
    if (union) {
      barLeft = (union.x + union.w / 2) * view.k + view.x;
      barTop = union.y * view.k + view.y - 8;
    } else if (shown.size === 1) {
      const sole = selectedItems[0];
      if (sole && itemKind(sole) === 'connector') {
        const mid = alongPath(
          itemConnectorPoints(sole, rects),
          sole.labelAt ?? 0.5,
        );
        barLeft = mid.x * view.k + view.x;
        barTop = mid.y * view.k + view.y - 10;
      }
    }
  }

  function geom(it: Item) {
    const startA =
      endDraft && endDraft.id === it.id && endDraft.which === 'start'
        ? endDraft.anchor
        : it.start;
    const endA =
      endDraft && endDraft.id === it.id && endDraft.which === 'end'
        ? endDraft.anchor
        : it.end;
    const ends = resolveEnds(startA, endA, rects, { x: it.x, y: it.y });
    let start = ends.start;
    let end = ends.end;
    if (dragging && dragging.ids.has(it.id)) {
      if (startA && !isAttach(startA)) {
        start = {
          p: { x: start.p.x + dragging.x, y: start.p.y + dragging.y },
          side: start.side,
        };
      }
      if (endA && !isAttach(endA)) {
        end = {
          p: { x: end.p.x + dragging.x, y: end.p.y + dragging.y },
          side: end.side,
        };
      }
    }
    if (resize && resize.ids.includes(it.id)) {
      if (startA && !isAttach(startA)) {
        start = { p: mapPoint(resize.from, resize.to, startA), side: null };
      }
      if (endA && !isAttach(endA)) {
        end = { p: mapPoint(resize.from, resize.to, endA), side: null };
      }
    }
    const pts = connectorPoints(
      start,
      end,
      it.route ?? 'straight',
      it.bend,
    );
    return { pts, start, end, mid: alongPath(pts, it.labelAt ?? 0.5) };
  }

  const draftPts = (() => {
    if (!draftLine) return null;
    const ends = resolveEnds(
      draftLine.start,
      draftLine.end,
      rects,
      { x: 0, y: 0 },
    );
    const route =
      props.tool.type === 'connector' ? props.tool.route : 'straight';
    return connectorPoints(ends.start, ends.end, route);
  })();

  return (
    <div
      ref={rootRef}
      className={
        'absolute inset-0 touch-none overflow-hidden select-none bg-[radial-gradient(circle,#d6d3d1_1px,transparent_1.2px)]' +
        cursor
      }
      style={{
        backgroundSize: '24px 24px',
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerLeave={() => setHoverId(null)}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        const files = [...e.dataTransfer.files].filter((f) =>
          f.type.startsWith('image/'),
        );
        if (!files.length) return;
        const at = ctxRef.current.toWorld(e.clientX, e.clientY);
        propsRef.current.onDropImages(files, at);
      }}
      onContextMenu={(e) => {
        if (!isEditable(e.target)) e.preventDefault();
      }}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
        }}>
        <svg
          className="absolute overflow-visible"
          width={1}
          height={1}
          style={{ overflow: 'visible', pointerEvents: 'none' }}>
          {lines.map((it) => {
            const { pts, start, end, mid } = geom(it);
            const selected = shown.has(it.id);
            const d = pathD(pts);
            const last = pts[pts.length - 1];
            const prev = pts[pts.length - 2] ?? start.p;
            const first = pts[0];
            const next = pts[1] ?? last;
            const color = selected ? '#0369a1' : '#52525b';
            const midSeg =
              (it.route ?? 'straight') === 'elbow' ? elbowMid(pts) : null;
            const size = labelSize.current.get(it.id);
            const gap =
              size && (it.text || props.editingId === it.id)
                ? {
                    x: mid.x - size.w / 2,
                    y: mid.y - size.h / 2,
                    w: size.w,
                    h: size.h,
                  }
                : null;
            return (
              <g
                key={it.id}
                data-item={it.id}
                ref={(el) => watchEl(it.id, el)}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: 'stroke' }}
                />
                {midSeg && (
                  <path
                    d={`M${midSeg.a.x} ${midSeg.a.y} L${midSeg.b.x} ${midSeg.b.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    data-bend={midSeg.axis}
                    style={{
                      pointerEvents: 'stroke',
                      cursor: midSeg.axis === 'x' ? 'ew-resize' : 'ns-resize',
                    }}
                  />
                )}
                <path
                  d={pathDGapped(pts, gap)}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  className="pointer-events-none"
                />
                <ArrowMark
                  kind={arrowStartOf(it)}
                  from={next}
                  to={first}
                  color={color}
                />
                <ArrowMark
                  kind={arrowEndOf(it)}
                  from={prev}
                  to={last}
                  color={color}
                />
                {selected && (
                  <>
                    <circle
                      data-end="start"
                      cx={start.p.x}
                      cy={start.p.y}
                      r={5 / view.k}
                      fill="#fff"
                      stroke="#0369a1"
                      strokeWidth={1.5 / view.k}
                      style={{ cursor: 'grab', pointerEvents: 'all' }}
                    />
                    <circle
                      data-end="end"
                      cx={end.p.x}
                      cy={end.p.y}
                      r={5 / view.k}
                      fill="#fff"
                      stroke="#0369a1"
                      strokeWidth={1.5 / view.k}
                      style={{ cursor: 'grab', pointerEvents: 'all' }}
                    />
                  </>
                )}
              </g>
            );
          })}
          {draftPts && (
            <g className="pointer-events-none">
              <path
                d={pathD(draftPts)}
                fill="none"
                stroke="#0369a1"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              <path
                d={arrowHead(
                  draftPts[draftPts.length - 2] ?? draftPts[0],
                  draftPts[draftPts.length - 1],
                )}
                fill="none"
                stroke="#0369a1"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
        {lines.map((it) => {
          const { mid } = geom(it);
          const editing = props.editingId === it.id;
          if (!it.text && !editing) return null;
          return (
            <div
              key={it.id + '-label'}
              data-item={it.id}
              {...(!editing ? { 'data-label': 'label' } : {})}
              ref={(el) => watchLabel(it.id, el)}
              className={
                'absolute z-[1] -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs text-zinc-600' +
                (editing ? '' : ' cursor-grab')
              }
              style={{ left: mid.x, top: mid.y }}>
              {editing ? (
                <Editor
                  initial={it.text}
                  onDone={(text) => propsRef.current.onEditCommit(it.id, text)}
                  label="Connector label"
                  className="text-xs"
                />
              ) : (
                it.text
              )}
            </div>
          );
        })}
        {placeBox && (
          <div
            className="pointer-events-none absolute border border-dashed border-sky-700 bg-sky-700/5"
            style={{
              left: placeBox.x,
              top: placeBox.y,
              width: placeBox.w,
              height: Math.max(24, placeBox.h),
            }}
          />
        )}
        {nodes.map((it) => {
          const liveBox =
            resize && resize.ids.includes(it.id) ? rects.get(it.id) : null;
          const drawn = liveBox
            ? { ...it, x: liveBox.x, y: liveBox.y, w: liveBox.w, h: liveBox.h }
            : it;
          const off =
            dragging && dragging.ids.has(it.id) && !liveBox
              ? dragging
              : null;
          return (
            <BoardItem
              key={it.id}
              item={drawn}
              selected={shown.has(it.id)}
              hovered={hoverId === it.id}
              showHandles={shown.size === 1}
              editing={props.editingId === it.id}
              flashing={flash.has(it.id)}
              offset={off}
              zoom={view.k}
              src={
                it.assetId
                  ? props.assetUrls?.[it.assetId]
                  : props.assetUrls?.[it.id]
              }
              embedActive={activeEmbedId === it.id}
              onEditCommit={(id, text) =>
                propsRef.current.onEditCommit(id, text)
              }
              onResizeDown={onResizeDown}
              register={watchEl}
            />
          );
        })}
        {!dragging &&
          !resize &&
          !draftLine &&
          (props.tool.type === 'select' || props.tool.type === 'connector') &&
          nodes.map((it) => {
            if (props.editingId === it.id) return null;
            const show =
              shown.has(it.id) || hoverId === it.id;
            if (!show) return null;
            const box = rects.get(it.id) ?? storedRect(it);
            const kind = itemKind(it);
            const plus = kind === 'sticky' || kind === 'shape';
            const r = 5 / view.k;
            return SIDES.map((side) => {
              const p = sidePoint(box, side);
              const q = outPoint(p, side, PLUS_OUT);
              return (
                <div key={it.id + side}>
                  <div
                    data-item={it.id}
                    data-dot={side}
                    aria-label={'Connect ' + side}
                    className="absolute z-20 rounded-full bg-white ring-1 ring-zinc-400 hover:ring-sky-700"
                    style={{
                      left: p.x,
                      top: p.y,
                      width: r * 2,
                      height: r * 2,
                      transform: 'translate(-50%, -50%)',
                      cursor: 'crosshair',
                    }}
                  />
                  {plus && (
                    <button
                      type="button"
                      data-item={it.id}
                      data-plus={side}
                      aria-label={'Add ' + side}
                      className="absolute z-20 flex items-center justify-center rounded-full border-0 bg-white text-zinc-600 ring-1 ring-zinc-300 hover:bg-sky-50 hover:text-sky-800 hover:ring-sky-700"
                      style={{
                        left: q.x,
                        top: q.y,
                        width: 18 / view.k,
                        height: 18 / view.k,
                        fontSize: 14 / view.k,
                        lineHeight: 1,
                        transform: 'translate(-50%, -50%)',
                        cursor: 'pointer',
                      }}>
                      +
                    </button>
                  )}
                </div>
              );
            });
          })}
        {shown.size > 1 && union && !props.editingId && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: union.x,
              top: union.y,
              width: union.w,
              height: union.h,
            }}>
            <div className="absolute inset-0 ring-[1.5px] ring-sky-700" />
            {BOX_HANDLES.map((h) => {
              const pos = HANDLE_POS[h];
              return (
                <div
                  key={h}
                  data-handle={h}
                  className="pointer-events-auto absolute z-10 size-1.5 rounded-[1px] bg-white ring-1 ring-sky-700"
                  style={{
                    left: pos.left,
                    top: pos.top,
                    cursor: pos.cursor,
                    transform: `translate(-50%, -50%) scale(${1 / view.k})`,
                  }}
                  onPointerDown={(e) => onUnionResizeDown(h, e)}
                />
              );
            })}
          </div>
        )}
      </div>
      {marquee && (
        <div
          className="pointer-events-none absolute border border-sky-700 bg-sky-700/10"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
      {shown.size > 0 && !dragging && !resize && !draftLine && (
          <SelectionBar
            items={selectedItems}
            left={barLeft}
            top={barTop}
            onPatchAll={props.onPatchAll}
            onToggleLock={props.onToggleLock}
            onArrange={props.onArrange}
            onFormat={props.onFormat}
          />
        )}
      {guides &&
        guides.v.map((x) => (
          <div
            key={'v' + x}
            className="pointer-events-none absolute top-0 z-30 w-px bg-sky-400"
            style={{ left: x * view.k + view.x, height: '100%' }}
          />
        ))}
      {guides &&
        guides.h.map((y) => (
          <div
            key={'h' + y}
            className="pointer-events-none absolute left-0 z-30 h-px bg-sky-400"
            style={{ top: y * view.k + view.y, width: '100%' }}
          />
        ))}
      {guides &&
        guides.ticks.map((t, i) => (
          <div
            key={'t' + i}
            className="pointer-events-none absolute z-30 bg-sky-400"
            style={{
              left: t.x * view.k + view.x,
              top: t.y * view.k + view.y,
              width: t.w ? Math.max(1, t.w * view.k) : 1,
              height: t.h ? Math.max(1, t.h * view.k) : 1,
            }}
          />
        ))}
    </div>
  );
}
