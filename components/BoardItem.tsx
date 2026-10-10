'use client';

import { useLayoutEffect, useRef } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { Handle, Item } from '@/lib/types';
import { FILLS, itemKind, SHAPE_SIZE, STICKY_SIZE } from '@/lib/items';
import { Markdown } from '@/lib/markdown';

const HANDLE_POS: Record<Handle, { left: string; top: string; cursor: string }> =
  {
    n: { left: '50%', top: '0%', cursor: 'ns-resize' },
    s: { left: '50%', top: '100%', cursor: 'ns-resize' },
    e: { left: '100%', top: '50%', cursor: 'ew-resize' },
    w: { left: '0%', top: '50%', cursor: 'ew-resize' },
    ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
    nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
    se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
    sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  };

function handlesFor(it: Item): Handle[] {
  const kind = itemKind(it);
  if (kind === 'shape') {
    return ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  }
  if (kind === 'sticky') return ['e', 'w', 'ne', 'nw', 'se', 'sw'];
  if (kind === 'text' && it.w) return ['e', 'w'];
  return [];
}

function shapeClip(shape: Item['shape']): string | undefined {
  if (shape === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  if (shape === 'triangle') return 'polygon(50% 0%, 100% 100%, 0% 100%)';
  return undefined;
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

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    const el = e.currentTarget;
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

interface Props {
  item: Item;
  selected: boolean;
  editing: boolean;
  flashing: boolean;
  offset: { x: number; y: number } | null;
  zoom: number;
  onEditCommit: (id: string, text: string) => void;
  onResizeDown: (id: string, handle: Handle, e: ReactPointerEvent) => void;
  register: (id: string, el: HTMLDivElement | null) => void;
}

export default function BoardItem(props: Props) {
  const it = props.item;
  const kind = itemKind(it);
  const fill = FILLS[it.fill ?? (kind === 'sticky' ? 'amber' : 'white')];
  const off = props.offset;
  const handles = props.selected && !props.editing ? handlesFor(it) : [];
  const w =
    it.w ??
    (kind === 'sticky' ? STICKY_SIZE : kind === 'shape' ? SHAPE_SIZE : undefined);
  const h =
    kind === 'shape' ? (it.h ?? SHAPE_SIZE) : undefined;
  const minH =
    kind === 'sticky' ? (it.h ?? STICKY_SIZE) : undefined;
  const clip = kind === 'shape' ? shapeClip(it.shape) : undefined;
  const round =
    kind === 'shape' && it.shape === 'ellipse'
      ? 'rounded-full'
      : kind === 'shape' && it.shape === 'roundRect'
        ? 'rounded-3xl'
        : kind === 'sticky'
          ? 'rounded-sm'
          : 'rounded-md';

  const body =
    props.editing ? (
      <Editor
        initial={it.text}
        onDone={(text) => props.onEditCommit(it.id, text)}
        label={kind === 'sticky' ? 'Sticky note' : kind === 'shape' ? 'Shape' : 'Text box'}
        className={
          kind === 'shape'
            ? 'w-full text-center'
            : kind === 'sticky'
              ? 'w-full'
              : ''
        }
      />
    ) : it.text ? (
      <Markdown text={it.text} />
    ) : null;

  return (
    <div
      data-item={it.id}
      ref={(el) => props.register(it.id, el)}
      className={
        'absolute text-sm leading-snug wrap-anywhere' +
        (kind === 'text' ? ' w-max min-w-7 px-2.5 py-1.5' : '') +
        (kind === 'text' && !it.w ? ' max-w-80' : '') +
        (kind === 'text' && !props.selected
          ? ' hover:ring-1 hover:ring-sky-300'
          : '') +
        (kind === 'sticky'
          ? ' px-3 py-2.5 shadow-[0_1px_0_rgba(28,25,23,0.06),0_1px_2px_rgba(28,25,23,0.05)]'
          : '') +
        (kind === 'shape'
          ? ' flex items-center justify-center px-4 py-3 text-center'
          : '') +
        (it.by === 'claude' && kind === 'text' ? ' text-base text-sky-800' : '') +
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
        minHeight: minH,
        maxWidth: kind === 'text' && it.w ? 'none' : undefined,
        color: kind === 'sticky' || kind === 'shape' ? fill.ink : undefined,
        background:
          kind === 'sticky' || (kind === 'text' && props.editing)
            ? kind === 'sticky'
              ? fill.bg
              : '#fff'
            : undefined,
        paddingTop: it.shape === 'triangle' ? '28%' : undefined,
      }}>
      {kind === 'shape' && (
        <div
          className={'absolute inset-0 ' + round}
          style={{
            background: fill.bg,
            clipPath: clip,
            border:
              '1.5px solid color-mix(in oklab, ' + fill.ink + ' 28%, transparent)',
            borderRadius:
              it.shape === 'ellipse'
                ? 9999
                : it.shape === 'roundRect'
                  ? 24
                  : 6,
          }}
        />
      )}
      <div className={'relative z-[1] min-w-0 ' + (kind === 'shape' ? 'w-full' : '')}>
        {kind === 'text' && it.by === 'claude' && (
          <div className="mb-1 font-mono text-[9.5px] font-medium tracking-widest text-sky-700 uppercase">
            Claude
          </div>
        )}
        {body}
      </div>
      {props.selected && (
        <div
          className={
            'pointer-events-none absolute inset-0 ring-[1.5px] ring-sky-700 ' +
            round
          }
        />
      )}
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
