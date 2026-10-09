'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Item, View } from '@/lib/types';

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

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
  apiRef: RefObject<CanvasApi | null>;
  onSelect(ids: Set<string>): void;
  onMove(ids: string[], dx: number, dy: number): void;
  onCreateAt(p: Pt): void;
  onEditStart(id: string): void;
  onEditCommit(id: string, text: string): void;
  onViewChange(v: View): void;
  onZoom(k: number): void;
}

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'move'; sx: number; sy: number; ids: string[]; clickId: string; wasSelected: boolean; shift: boolean; moved: boolean }
  | { kind: 'marquee'; sx: number; sy: number; base: Set<string>; moved: boolean };

const MIN_K = 0.1;
const MAX_K = 4;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

export default function Canvas(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(props.initialView ?? { x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const propsRef = useRef(props);
  propsRef.current = props;

  const [dragging, setDragging] = useState<{ ids: Set<string>; x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [preview, setPreview] = useState<Set<string> | null>(null);
  const previewRef = useRef<Set<string> | null>(null);
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const spaceRef = useRef(false);

  const dragRef = useRef<Drag | null>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const pointerWorld = useRef<Pt | null>(null);
  const touches = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d0: number; k0: number } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

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
      return { k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) };
    });
  }

  function fitTo(items: Item[]) {
    const r = rootRect();
    if (!r) return;
    if (!items.length) {
      setView({ x: r.width / 2 - 140, y: r.height * 0.4, k: 1 });
      return;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of items) {
      const el = els.current.get(it.id);
      const w = el ? el.offsetWidth : 240;
      const h = el ? el.offsetHeight : 40;
      x0 = Math.min(x0, it.x);
      y0 = Math.min(y0, it.y);
      x1 = Math.max(x1, it.x + w);
      y1 = Math.max(y1, it.y + h);
    }
    const pad = 80;
    const k = clampK(Math.min(1, (r.width - pad * 2) / Math.max(1, x1 - x0), (r.height - pad * 2 - 60) / Math.max(1, y1 - y0)));
    setView({ k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - 60 - (y1 - y0) * k) / 2 - y0 * k });
  }

  // First frame: use the saved view, or fit what's there.
  useLayoutEffect(() => {
    if (!props.initialView) fitTo(props.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the view (debounced) and report zoom.
  useEffect(() => {
    const t = setTimeout(() => propsRef.current.onViewChange(view), 300);
    return () => clearTimeout(t);
  }, [view]);
  useEffect(() => {
    propsRef.current.onZoom(view.k);
  }, [view.k]);

  // Imperative API for the toolbar, keyboard shortcuts and the assistant panel.
  useEffect(() => {
    const api: CanvasApi = {
      center: () => {
        const r = rootRect();
        const v = viewRef.current;
        return r ? { x: (r.width / 2 - v.x) / v.k, y: (r.height / 2 - v.y) / v.k } : { x: 0, y: 0 };
      },
      pointer: () => pointerWorld.current,
      fit: () => fitTo(propsRef.current.items),
      zoomTo: (k: number) => {
        const r = rootRect();
        if (r) zoomAt(r.width / 2, r.height / 2, k / viewRef.current.k);
      },
      rectOf: (id: string) => {
        const it = propsRef.current.items.find((i) => i.id === id);
        const el = els.current.get(id);
        return it ? { x: it.x, y: it.y, w: el ? el.offsetWidth : 240, h: el ? el.offsetHeight : 40 } : null;
      },
      panTo: (p: Pt) => {
        const r = rootRect();
        if (!r) return;
        setView((v) => ({ ...v, x: r.width / 2 - p.x * v.k, y: r.height / 2 - p.y * v.k }));
      },
    };
    const ref = props.apiRef;
    ref.current = api;
    return () => {
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel and trackpad: scroll pans, pinch (ctrl/meta + wheel) zooms. Native listener so we can preventDefault.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (isEditable(e.target) && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
      } else {
        const unit = e.deltaMode === 1 ? 16 : 1;
        const dx = e.deltaX * unit;
        const dy = e.deltaY * unit;
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    // Safari trackpad pinch arrives as gesture events.
    let lastScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
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

  // Space held = hand tool, as in Figma.
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

  // Pointer moves and releases are tracked on window so a drag can leave the canvas.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = rootRect();
      if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        pointerWorld.current = toWorld(e.clientX, e.clientY);
      }
      if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch.current && touches.current.size >= 2 && r) {
          const [a, b] = Array.from(touches.current.values());
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const k = clampK((pinch.current.k0 * d) / pinch.current.d0);
          zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, k / viewRef.current.k);
          return;
        }
      }
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true;
      if (d.kind === 'pan') {
        setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
      } else if (d.kind === 'move') {
        const k = viewRef.current.k;
        setDragging({ ids: new Set(d.ids), x: dx / k, y: dy / k });
      } else if (r) {
        const m = { x0: d.sx - r.left, y0: d.sy - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top };
        setMarquee(m);
        const left = Math.min(d.sx, e.clientX), right = Math.max(d.sx, e.clientX);
        const top = Math.min(d.sy, e.clientY), bottom = Math.max(d.sy, e.clientY);
        const hits = new Set(d.base);
        els.current.forEach((el, id) => {
          const b = el.getBoundingClientRect();
          if (b.right >= left && b.left <= right && b.bottom >= top && b.top <= bottom) hits.add(id);
        });
        previewRef.current = hits;
        setPreview(hits);
      }
    };

    const up = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touches.current.delete(e.pointerId);
        if (touches.current.size < 2) pinch.current = null;
      }
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setPanning(false);
      const p = propsRef.current;
      if (d.kind === 'move') {
        if (d.moved) {
          const k = viewRef.current.k;
          p.onMove(d.ids, (e.clientX - d.sx) / k, (e.clientY - d.sy) / k);
        } else if (!d.shift && d.wasSelected && p.selected.size > 1) {
          p.onSelect(new Set([d.clickId]));
        }
        setDragging(null);
      } else if (d.kind === 'marquee') {
        if (d.moved) p.onSelect(previewRef.current ?? new Set());
        else p.onSelect(new Set());
        previewRef.current = null;
        setPreview(null);
        setMarquee(null);
      } else if (!d.moved && e.pointerType === 'touch') {
        // Double-tap on empty canvas creates a box (touch screens don't send dblclick reliably).
        const now = Date.now();
        const last = lastTap.current;
        if (last && now - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
          lastTap.current = null;
          const w = toWorld(e.clientX, e.clientY);
          p.onCreateAt({ x: w.x - 8, y: w.y - 14 });
        } else {
          lastTap.current = { t: now, x: e.clientX, y: e.clientY };
          p.onSelect(new Set());
        }
      }
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

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (isEditable(e.target)) return;
    const p = propsRef.current;
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        const [a, b] = Array.from(touches.current.values());
        pinch.current = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k0: viewRef.current.k };
        dragRef.current = null;
        setDragging(null);
        return;
      }
    }
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    const itemEl = target.closest<HTMLElement>('[data-item]');
    const itemId = itemEl ? itemEl.dataset.item ?? null : null;
    const v = viewRef.current;

    if (e.button === 1 || spaceRef.current || (!itemId && e.pointerType === 'touch')) {
      e.preventDefault();
      dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false };
      setPanning(true);
      return;
    }

    if (itemId) {
      const wasSelected = p.selected.has(itemId);
      if (e.shiftKey) {
        const next = new Set(p.selected);
        if (wasSelected) next.delete(itemId);
        else next.add(itemId);
        p.onSelect(next);
        if (wasSelected) return;
        dragRef.current = { kind: 'move', sx: e.clientX, sy: e.clientY, ids: Array.from(next), clickId: itemId, wasSelected, shift: true, moved: false };
        return;
      }
      const ids = wasSelected ? Array.from(p.selected) : [itemId];
      if (!wasSelected) p.onSelect(new Set([itemId]));
      dragRef.current = { kind: 'move', sx: e.clientX, sy: e.clientY, ids, clickId: itemId, wasSelected, shift: false, moved: false };
      return;
    }

    dragRef.current = { kind: 'marquee', sx: e.clientX, sy: e.clientY, base: e.shiftKey ? new Set(p.selected) : new Set(), moved: false };
  }

  function onDoubleClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (isEditable(e.target)) return;
    const target = e.target as HTMLElement;
    const itemEl = target.closest<HTMLElement>('[data-item]');
    const id = itemEl ? itemEl.dataset.item : undefined;
    if (id) {
      props.onEditStart(id);
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    props.onCreateAt({ x: w.x - 8, y: w.y - 14 });
  }

  const shown = preview ?? props.selected;
  const flash = new Set(props.flash);
  const grid = Math.max(8, 24 * view.k);

  return (
    <div
      ref={rootRef}
      className={
        'absolute inset-0 touch-none overflow-hidden select-none bg-[radial-gradient(circle,#d6d3d1_1px,transparent_1.2px)]' +
        (panning ? ' cursor-grabbing' : spaceDown ? ' cursor-grab' : '')
      }
      style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        if (!isEditable(e.target)) e.preventDefault();
      }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {props.items.map((it) => {
          const off = dragging && dragging.ids.has(it.id) ? dragging : null;
          const editing = props.editingId === it.id;
          const selected = shown.has(it.id);
          return (
            <div
              key={it.id}
              data-item={it.id}
              ref={(el) => {
                if (el) els.current.set(it.id, el);
                else els.current.delete(it.id);
              }}
              className={
                'absolute w-max min-w-7 max-w-80 rounded-md px-2.5 py-1.5 text-[15px] leading-snug wrap-anywhere whitespace-pre-wrap' +
                (it.by === 'claude' ? ' font-serif text-base text-sky-800' : '') +
                (selected ? ' ring-[1.5px] ring-sky-700' : ' hover:ring-1 hover:ring-sky-300') +
                (editing ? ' bg-white ring-[1.5px] ring-sky-700' : '') +
                (off ? ' opacity-85' : '') +
                (flash.has(it.id) ? ' animate-flash motion-reduce:animate-none motion-reduce:bg-amber-200/70' : '')
              }
              style={{ left: it.x + (off ? off.x : 0), top: it.y + (off ? off.y : 0), width: it.w ?? undefined }}
            >
              {it.by === 'claude' && (
                <div className="mb-1 font-mono text-[9.5px] font-medium tracking-widest text-sky-700 uppercase">Claude</div>
              )}
              {editing ? (
                <Editor initial={it.text} onDone={(text) => propsRef.current.onEditCommit(it.id, text)} />
              ) : (
                <div>{it.text}</div>
              )}
            </div>
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
    </div>
  );
}

function Editor({ initial, onDone }: { initial: string; onDone: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = initial;
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onDone(ref.current ? ref.current.innerText : initial);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  return (
    <div
      ref={ref}
      className="min-h-[1.42em] min-w-[2ch] cursor-text outline-none select-text"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline="true"
      aria-label="Text box"
      onBlur={finish}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
