'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { Handle, Item, ShapeKind } from '@/lib/types';
import {
  fontPx,
  itemKind,
  paintOf,
  SHAPE_SIZE,
  STICKY_SIZE,
  storedRect,
  strokeOf,
  textAlign,
  textInk,
} from '@/lib/items';
import { Markdown } from '@/lib/markdown';
import { shapePad, shapePaths } from '@/lib/shapes';
import { FORMAT_EVENT, wrapSelection, type FormatKind } from '@/lib/format';

export const HANDLE_POS: Record<
  Handle,
  { left: string; top: string; cursor: string }
> = {
  n: { left: '50%', top: '0%', cursor: 'ns-resize' },
  s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' },
  w: { left: '0%', top: '50%', cursor: 'ew-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
  sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
};

export const BOX_HANDLES: Handle[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
];

function hostOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function LinkCard({ item, claude }: { item: Item; claude: boolean }) {
  const title = item.meta?.title || hostOf(item.url) || item.url || 'Link';
  const desc = item.meta?.description;
  const site = item.meta?.siteName || hostOf(item.url);
  return (
    <div
      className={
        'flex h-full flex-col overflow-hidden ' +
        (claude ? 'bg-sky-50 text-sky-900' : 'bg-white text-zinc-900')
      }>
      {item.meta?.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.meta.thumb}
          alt=""
          draggable={false}
          className="pointer-events-none h-16 w-full shrink-0 object-cover"
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-2.5 py-2">
        <div className="truncate text-[13px] font-medium">{title}</div>
        {desc ? (
          <div className="line-clamp-2 text-[11px] leading-snug text-zinc-500">
            {desc}
          </div>
        ) : null}
        <div
          className={
            'mt-auto truncate text-[10px] ' +
            (claude ? 'text-sky-700' : 'text-zinc-400')
          }>
          {site}
        </div>
      </div>
    </div>
  );
}

function handlesFor(it: Item): Handle[] {
  const kind = itemKind(it);
  if (kind === 'shape' || kind === 'image' || kind === 'link' || kind === 'embed') {
    return ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  }
  if (kind === 'sticky') return ['e', 'w', 'ne', 'nw', 'se', 'sw'];
  if (kind === 'text' && it.w) return ['e', 'w'];
  return [];
}

export function ShapeSvg({
  kind,
  w,
  h,
  fill,
  stroke,
  strokeWidth = 1.5,
  strokeDasharray,
  className = '',
}: {
  kind: ShapeKind | undefined;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  className?: string;
}) {
  const paths = shapePaths(kind, w, h);
  return (
    <svg
      className={'overflow-visible ' + className}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function caretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function insertAtCaret(el: HTMLElement, text: string) {
  el.focus();
  document.execCommand('insertText', false, text);
}

export function Editor({
  initial,
  onDone,
  className = '',
  label = 'Text box',
}: {
  initial: string;
  onDone: (text: string) => void;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const live = useRef(initial);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = initial;
    live.current = initial;
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
    if (ref.current) live.current = ref.current.innerText;
    onDone(live.current);
  }

  function applyFormat(kind: FormatKind) {
    const el = ref.current;
    if (!el) return;
    const text = el.innerText.replace(/\r/g, '');
    const sel = window.getSelection();
    let a = caretOffset(el);
    let b = a;
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      const pre = r.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(r.startContainer, r.startOffset);
      a = pre.toString().length;
      b = a + r.toString().length;
    }
    const next = wrapSelection(text, a, b, kind);
    el.textContent = next.text;
    live.current = next.text;
    setRange(el, next.start, next.end);
  }

  useLayoutEffect(() => {
    function onFormat(e: Event) {
      const kind = (e as CustomEvent<FormatKind>).detail;
      if (kind) applyFormat(kind);
    }
    window.addEventListener(FORMAT_EVENT, onFormat);
    return () => window.removeEventListener(FORMAT_EVENT, onFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    const el = e.currentTarget;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyFormat('bold');
      return;
    }
    if (mod && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyFormat('italic');
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      applyFormat('strike');
      return;
    }
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      el.blur();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const text = el.innerText.replace(/\r/g, '');
        const off = caretOffset(el);
        const lineStart = text.lastIndexOf('\n', off - 1) + 1;
        if (text[lineStart] === '\t') {
          el.textContent = text.slice(0, lineStart) + text.slice(lineStart + 1);
          setCaret(el, Math.max(lineStart, off - 1));
        }
      } else {
        insertAtCaret(el, '\t');
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const text = el.innerText.replace(/\r/g, '');
      const off = caretOffset(el);
      const lineStart = text.lastIndexOf('\n', off - 1) + 1;
      const line = text.slice(lineStart, off);
      const m = line.match(/^(\t*)([-*] |\d+\. )(.*)$/);
      if (!m) return;
      e.preventDefault();
      if (!m[3]) {
        el.textContent = text.slice(0, lineStart) + text.slice(off);
        setCaret(el, lineStart);
        return;
      }
      let marker = m[2];
      const num = marker.match(/^(\d+)\. /);
      if (num) marker = `${Number(num[1]) + 1}. `;
      insertAtCaret(el, `\n${m[1]}${marker}`);
    }
  }

  return (
    <div
      ref={ref}
      className={
        'min-h-[1.42em] min-w-[2ch] cursor-text outline-none select-text ' +
        className
      }
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      onInput={() => {
        if (ref.current) live.current = ref.current.innerText;
      }}
      onBlur={finish}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

function setCaret(el: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n = walker.nextNode();
  let left = offset;
  while (n) {
    const len = n.textContent?.length ?? 0;
    if (left <= len) {
      const range = document.createRange();
      range.setStart(n, Math.max(0, left));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    left -= len;
    n = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function setRange(el: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const point = (offset: number) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    let left = offset;
    while (n) {
      const len = n.textContent?.length ?? 0;
      if (left <= len) return { n, off: Math.max(0, left) };
      left -= len;
      n = walker.nextNode();
    }
    return null;
  };
  const a = point(start);
  const b = point(end);
  const range = document.createRange();
  if (a) range.setStart(a.n, a.off);
  else range.selectNodeContents(el);
  if (b) range.setEnd(b.n, b.off);
  else range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function FitText({
  maxPx,
  height,
  children,
}: {
  maxPx: number;
  height: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = maxPx;
      el.style.fontSize = size + 'px';
      while (size > 10 && el.scrollHeight > el.clientHeight + 1) {
        size -= 1;
        el.style.fontSize = size + 'px';
      }
    };
    fit();
    const obs = new MutationObserver(fit);
    obs.observe(el, { subtree: true, characterData: true, childList: true });
    el.addEventListener('input', fit);
    return () => {
      obs.disconnect();
      el.removeEventListener('input', fit);
    };
  }, [maxPx, height]);
  return (
    <div
      ref={ref}
      className="h-full overflow-hidden"
      style={{ fontSize: maxPx, height }}>
      {children}
    </div>
  );
}

interface Props {
  item: Item;
  selected: boolean;
  hovered?: boolean;
  showHandles?: boolean;
  editing: boolean;
  flashing: boolean;
  offset: { x: number; y: number } | null;
  zoom: number;
  src?: string;
  onEditCommit: (id: string, text: string) => void;
  onResizeDown: (id: string, handle: Handle, e: ReactPointerEvent) => void;
  register: (id: string, el: HTMLDivElement | null) => void;
}

export default function BoardItem(props: Props) {
  const it = props.item;
  const kind = itemKind(it);
  const fill = paintOf(it);
  const stroke = strokeOf(it);
  const ink = textInk(it);
  const off = props.offset;
  const handles =
    props.selected &&
    !props.editing &&
    props.showHandles !== false
      ? handlesFor(it)
      : [];
  const framed = kind === 'image' || kind === 'link' || kind === 'embed';
  const frame = framed ? storedRect(it) : null;
  const w =
    it.w ??
    (kind === 'sticky'
      ? STICKY_SIZE
      : kind === 'shape'
        ? SHAPE_SIZE
        : frame?.w);
  const h =
    kind === 'shape'
      ? (it.h ?? SHAPE_SIZE)
      : kind === 'sticky'
        ? (it.h ?? STICKY_SIZE)
        : frame
          ? frame.h
          : undefined;
  const round = kind === 'sticky' ? 'rounded-sm' : 'rounded-md';
  const shapeW = kind === 'shape' ? (w ?? SHAPE_SIZE) : 0;
  const shapeH = kind === 'shape' ? (h ?? SHAPE_SIZE) : 0;
  const px = fontPx(it);
  const align = textAlign(it);
  const alignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  const rawBody =
    kind === 'image' ? null : props.editing ? (
      <Editor
        initial={it.text}
        onDone={(text) => props.onEditCommit(it.id, text)}
        label={kind === 'sticky' ? 'Sticky note' : kind === 'shape' ? 'Shape' : 'Text box'}
        className={'w-full ' + alignClass}
      />
    ) : it.text ? (
      <Markdown text={it.text} />
    ) : null;
  const body =
    kind === 'sticky' && rawBody && h ? (
      <FitText
        maxPx={px}
        height={Math.max(20, h - 20)}>
        {rawBody}
      </FitText>
    ) : (
      rawBody
    );

  return (
    <div
      data-item={it.id}
      ref={(el) => props.register(it.id, el)}
      className={
        'absolute text-sm leading-snug wrap-anywhere' +
        (kind === 'text' ? ' w-max min-w-7 px-2.5 py-1.5' : '') +
        (kind === 'text' && !it.w ? ' max-w-80' : '') +
        (kind === 'text' && !props.selected && !props.hovered
          ? ' hover:ring-1 hover:ring-sky-300'
          : '') +
        (kind === 'sticky'
          ? ' px-3 py-2.5 shadow-[0_1px_0_rgba(28,25,23,0.06),0_1px_2px_rgba(28,25,23,0.05)]'
          : '') +
        (kind === 'image' ? ' overflow-hidden bg-stone-200' : '') +
        (kind === 'link'
          ? ' cursor-pointer overflow-hidden bg-white shadow-[0_1px_0_rgba(28,25,23,0.06),0_1px_2px_rgba(28,25,23,0.05)]'
          : '') +
        (kind === 'shape'
          ? ' flex items-center ' +
            (align === 'center'
              ? 'justify-center'
              : align === 'right'
                ? 'justify-end'
                : 'justify-start') +
            ' ' +
            alignClass
          : framed
            ? ''
            : ' ' + alignClass) +
        (fill.claude && kind === 'text' ? ' text-base text-sky-800' : '') +
        (props.selected ? ' z-1' : '') +
        (off ? ' opacity-85' : '') +
        (props.flashing
          ? ' animate-flash motion-reduce:animate-none motion-reduce:bg-amber-200/70'
          : '')
      }
      style={{
        left: it.x + (off ? off.x : 0),
        top: it.y + (off ? off.y : 0),
        width: w,
        height: h,
        fontSize: kind === 'sticky' ? undefined : px,
        maxWidth: kind === 'text' && it.w ? 'none' : undefined,
        color:
          kind === 'sticky' || kind === 'shape' || kind === 'text'
            ? ink
            : kind === 'image'
              ? ink
              : undefined,
        background:
          kind === 'sticky' || (kind === 'text' && props.editing)
            ? kind === 'sticky'
              ? fill.bg
              : '#fff'
            : undefined,
        padding: kind === 'shape' ? shapePad(it.shape) : undefined,
      }}>
      {kind === 'shape' && (
        <ShapeSvg
          kind={it.shape}
          w={shapeW}
          h={shapeH}
          fill={fill.bg}
          stroke={stroke ? stroke.color : 'none'}
          strokeWidth={stroke?.width}
          strokeDasharray={stroke?.dash}
          className="pointer-events-none absolute inset-0"
        />
      )}
      {kind === 'image' && (
        <>
          {props.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.src}
              alt={it.caption ?? ''}
              draggable={false}
              className="pointer-events-none block size-full"
            />
          ) : (
            <div className="size-full bg-stone-200" />
          )}
          {(props.editing || it.caption) && (
            <div
              className={
                'absolute inset-x-0 bottom-0 z-[1] px-2 py-1 text-xs leading-snug ' +
                (fill.claude ? 'bg-sky-100/90 text-sky-800' : 'bg-white/90')
              }>
              {props.editing ? (
                <Editor
                  initial={it.caption ?? ''}
                  onDone={(text) => props.onEditCommit(it.id, text)}
                  label="Caption"
                  className="w-full"
                />
              ) : (
                it.caption
              )}
            </div>
          )}
        </>
      )}
      {kind === 'link' && (
        <LinkCard
          item={it}
          claude={fill.claude}
        />
      )}
      {kind !== 'image' && kind !== 'link' && (
      <div className={'relative z-[1] min-w-0 ' + (kind === 'shape' ? 'w-full' : '')}>
        {kind === 'text' && it.by === 'claude' && (
          <div className="mb-1 font-mono text-[9.5px] font-medium tracking-widest text-sky-700 uppercase">
            Claude
          </div>
        )}
        {body}
      </div>
      )}
      {props.selected ? (
        <div
          className={
            'pointer-events-none absolute inset-0 ring-[1.5px] ring-sky-700 ' +
            round
          }
        />
      ) : props.hovered ? (
        <div
          className={
            'pointer-events-none absolute inset-0 ring-1 ring-sky-300 ' + round
          }
        />
      ) : null}
      {handles.map((h) => {
        const pos = HANDLE_POS[h];
        return (
          <div
            key={h}
            data-handle={h}
            className="absolute z-10 size-1.5 rounded-[1px] bg-white ring-1 ring-sky-700"
            style={{
              left: pos.left,
              top: pos.top,
              cursor: pos.cursor,
              transform: `translate(-50%, -50%) scale(${1 / props.zoom})`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              props.onResizeDown(it.id, h, e);
            }}
          />
        );
      })}
    </div>
  );
}
