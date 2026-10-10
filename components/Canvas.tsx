'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react';
import type {
  Anchor,
  Handle,
  Item,
  Tool,
  View,
} from '@/lib/types';
import { itemKind, storedRect, type Rect } from '@/lib/items';
import {
  alongPath,
  arrowHead,
  connectorPoints,
  pathD,
  resolveAnchor,
  type Pt,
} from '@/lib/connectors';
import BoardItem, { Editor } from './BoardItem';
import SelectionBar from './SelectionBar';
import type { CreateDraft, Drag, InteractionCtx } from './canvas/types';
import { isEditable } from './canvas/types';
import { liveRects } from './canvas/liveRects';
import { startPan } from './canvas/pan';
import { startMove } from './canvas/move';
import { startMarquee } from './canvas/marquee';
import { startResize } from './canvas/resize';
import { placeShape, placeSticky, startPlace } from './canvas/place';
import { startConnect } from './canvas/connect';
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
  stickyFill: Fill;
  apiRef: RefObject<CanvasApi | null>;
  onSelect(ids: Set<string>): void;
  onMove(ids: string[], dx: number, dy: number): void;
  onCreate(draft: CreateDraft): void;
  onResize(id: string, box: Rect, handle: Handle): void;
  onPatch(id: string, patch: Partial<Item>): void;
  onEditStart(id: string): void;
  onEditCommit(id: string, text: string): void;
  onViewChange(v: View): void;
  onZoom(k: number): void;
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
  const [resize, setResize] = useState<(Rect & { id: string }) | null>(null);
  const [endDraft, setEndDraft] = useState<{
    id: string;
    which: 'start' | 'end';
    anchor: Anchor;
  } | null>(null);

  const dragRef = useRef<Drag | null>(null);
  const els = useRef(new Map<string, Element>());
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
      els.current,
      dragging,
      resize,
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
    toWorld,
    currentRects,
    rootRect,
  };

  function fitTo(items: Item[]) {
    const r = rootRect();
    if (!r) return;
    if (!items.length) {
      setView({ x: r.width / 2 - 140, y: r.height * 0.4, k: 1 });
      return;
    }
    const rects = liveRects(items, els.current, null, null);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const it of items) {
      if (itemKind(it) === 'connector') {
        const s = resolveAnchor(it.start, rects, { x: it.x, y: it.y });
        const e = resolveAnchor(it.end, rects, { x: it.x, y: it.y });
        const pts = connectorPoints(s, e, it.route ?? 'straight');
        for (const p of pts) {
          x0 = Math.min(x0, p.x);
          y0 = Math.min(y0, p.y);
          x1 = Math.max(x1, p.x);
          y1 = Math.max(y1, p.y);
        }
        continue;
      }
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
          const rects = liveRects(propsRef.current.items, els.current, null, null);
          const s = resolveAnchor(it.start, rects, { x: it.x, y: it.y });
          const e = resolveAnchor(it.end, rects, { x: it.x, y: it.y });
          const mid = alongPath(
            connectorPoints(s, e, it.route ?? 'straight'),
          );
          return { x: mid.x, y: mid.y, w: 0, h: 0 };
        }
        const el = els.current.get(id);
        return {
          x: it.x,
          y: it.y,
          w: el instanceof HTMLElement ? el.offsetWidth : storedRect(it).w,
          h: el instanceof HTMLElement ? el.offsetHeight : storedRect(it).h,
        };
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
      if (!d) return;
      const dx = e.clientX - ('sx' in d ? d.sx : 0);
      const dy = e.clientY - ('sy' in d ? d.sy : 0);
      if (!d.moved && Math.hypot(dx, dy) < 3 && d.kind !== 'connector' && d.kind !== 'endpoint')
        return;
      d.moved = true;
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
    const next = startResize(ctxRef.current, id, handle, e);
    if (next) dragRef.current = next;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (isEditable(e.target)) return;
    const ctx = ctxRef.current;
    const p = ctx.propsRef.current;
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
    const itemEl = target.closest<HTMLElement>('[data-item]');
    const id = itemEl ? itemEl.dataset.item : undefined;
    if (id) {
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
  const nodes = props.items.filter((it) => itemKind(it) !== 'connector');
  const lines = props.items.filter((it) => itemKind(it) === 'connector');
  const rects = liveRects(props.items, els.current, dragging, resize);
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

  const soleId =
    shown.size === 1 && !props.editingId ? Array.from(shown)[0] : null;
  const sole = soleId
    ? props.items.find((i) => i.id === soleId)
    : undefined;
  let barLeft = 0;
  let barTop = 0;
  if (sole) {
    if (itemKind(sole) === 'connector') {
      const s = resolveAnchor(sole.start, rects, { x: sole.x, y: sole.y });
      const e = resolveAnchor(sole.end, rects, { x: sole.x, y: sole.y });
      const mid = alongPath(connectorPoints(s, e, sole.route ?? 'straight'));
      barLeft = mid.x * view.k + view.x;
      barTop = mid.y * view.k + view.y - 10;
    } else {
      const box = rects.get(sole.id) ?? storedRect(sole);
      barLeft = (box.x + box.w / 2) * view.k + view.x;
      barTop = box.y * view.k + view.y - 8;
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
    const start = resolveAnchor(startA, rects, { x: it.x, y: it.y });
    const end = resolveAnchor(endA, rects, { x: it.x, y: it.y });
    const pts = connectorPoints(start, end, it.route ?? 'straight');
    return { pts, start, end, mid: alongPath(pts) };
  }

  const draftPts = (() => {
    if (!draftLine) return null;
    const s = resolveAnchor(draftLine.start, rects, { x: 0, y: 0 });
    const e = resolveAnchor(draftLine.end, rects, { x: 0, y: 0 });
    const route =
      props.tool.type === 'connector' ? props.tool.route : 'straight';
    return connectorPoints(s, e, route);
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
      onDoubleClick={onDoubleClick}
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
            const { pts, start, end } = geom(it);
            const selected = shown.has(it.id);
            const d = pathD(pts);
            const last = pts[pts.length - 1];
            const prev = pts[pts.length - 2] ?? start.p;
            return (
              <g
                key={it.id}
                data-item={it.id}
                ref={(el) => {
                  if (el) els.current.set(it.id, el);
                  else els.current.delete(it.id);
                }}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: 'stroke' }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={selected ? '#0369a1' : '#52525b'}
                  strokeWidth={1.5}
                  className="pointer-events-none"
                />
                <path
                  d={arrowHead(prev, last)}
                  fill="none"
                  stroke={selected ? '#0369a1' : '#52525b'}
                  strokeWidth={1.5}
                  className="pointer-events-none"
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
              className="absolute z-[1] -translate-x-1/2 -translate-y-1/2 bg-white px-1.5 py-0.5 text-xs text-zinc-600"
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
          const previewBox =
            resize && resize.id === it.id ? resize : null;
          const drawn = previewBox
            ? { ...it, x: previewBox.x, y: previewBox.y, w: previewBox.w, h: previewBox.h }
            : it;
          const off =
            dragging && dragging.ids.has(it.id) && !previewBox
              ? dragging
              : null;
          return (
            <BoardItem
              key={it.id}
              item={drawn}
              selected={shown.has(it.id)}
              editing={props.editingId === it.id}
              flashing={flash.has(it.id)}
              offset={off}
              zoom={view.k}
              onEditCommit={(id, text) =>
                propsRef.current.onEditCommit(id, text)
              }
              onResizeDown={onResizeDown}
              register={(id, el) => {
                if (el) els.current.set(id, el);
                else els.current.delete(id);
              }}
            />
          );
        })}
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
      {sole && !dragging && !resize && !draftLine && (
        <SelectionBar
          item={sole}
          left={barLeft}
          top={barTop}
          onFill={(fill) => props.onPatch(sole.id, { fill })}
          onRoute={(route) => props.onPatch(sole.id, { route })}
        />
      )}
    </div>
  );
}
