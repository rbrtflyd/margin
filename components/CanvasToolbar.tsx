'use client';

import { useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cursor01Icon,
  Image01Icon,
  LineIcon,
  StickyNote01Icon,
  TextIcon,
} from '@hugeicons/core-free-icons';
import type { Route, ShapeKind, Tool } from '@/lib/types';
import { SHAPES } from '@/lib/items';
import { shapePaths } from '@/lib/shapes';
import { Island } from './Island';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const btn =
  'inline-flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 py-1.5 text-[13.5px] whitespace-nowrap hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100 aria-pressed:[&_kbd]:text-current aria-pressed:[&_kbd]:opacity-70 max-sm:px-1.5';
const kbd = 'font-mono text-[10.5px] font-medium text-zinc-400 max-sm:hidden';

function ShapeThumb({ kind }: { kind: ShapeKind }) {
  const w = 22;
  const h = 16;
  const paths = shapePaths(kind, w, h);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      className="size-[22px] overflow-visible">
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

interface Props {
  zoom: number;
  askOpen: boolean;
  tool: Tool;
  onTool(tool: Tool): void;
  onAsk(): void;
  onZoomBy(factor: number): void;
  onZoom100(): void;
  onFit(): void;
  onFrameSelection(): void;
  sections: { id: string; name: string }[];
  onJumpSection(id: string): void;
  snapGrid: boolean;
  onSnapGrid(on: boolean): void;
  onPickImages(files: File[]): void;
  onSeed?: () => void;
}

export default function CanvasToolbar(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const shape = props.tool.type === 'shape' ? props.tool.shape : 'rect';
  const route: Route =
    props.tool.type === 'connector' ? props.tool.route : 'straight';

  return (
    <Island
      position="bottom-center"
      as="nav"
      className="flex items-center gap-0.5 p-1"
      aria-label="Toolbar">
      <button
        type="button"
        className={btn}
        aria-pressed={props.tool.type === 'select'}
        title="Pointer (V)"
        onClick={() => props.onTool({ type: 'select' })}>
        <HugeiconsIcon
          icon={Cursor01Icon}
          size={16}
          strokeWidth={2}
        />
        <span className="max-sm:hidden">Pointer</span>
        <kbd className={kbd}>V</kbd>
      </button>
      <button
        type="button"
        className={btn}
        aria-pressed={props.tool.type === 'text'}
        title="Text (T)"
        onClick={() => props.onTool({ type: 'text' })}>
        <HugeiconsIcon
          icon={TextIcon}
          size={16}
          strokeWidth={2}
        />
        <span className="max-sm:hidden">Text</span>
        <kbd className={kbd}>T</kbd>
      </button>
      <button
        type="button"
        className={btn}
        aria-pressed={props.tool.type === 'sticky'}
        title="Sticky (S)"
        onClick={() => props.onTool({ type: 'sticky' })}>
        <HugeiconsIcon
          icon={StickyNote01Icon}
          size={16}
          strokeWidth={2}
        />
        <span className="max-sm:hidden">Sticky</span>
        <kbd className={kbd}>S</kbd>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={btn}
          aria-pressed={props.tool.type === 'shape'}
          title="Shape (R, O)">
          <ShapeThumb kind={shape} />
          <span className="max-sm:hidden">Shape</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          className="grid w-[196px] min-w-0 grid-cols-4 gap-0.5 p-1.5">
          {SHAPES.map((s) => (
            <DropdownMenuItem
              key={s.id}
              title={s.label}
              aria-label={s.label}
              className="flex size-10 items-center justify-center p-0"
              onClick={() => props.onTool({ type: 'shape', shape: s.id })}>
              <ShapeThumb kind={s.id} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={btn}
          aria-pressed={props.tool.type === 'connector'}
          title="Line (L, X)">
          <HugeiconsIcon
            icon={LineIcon}
            size={16}
            strokeWidth={2}
          />
          <span className="max-sm:hidden">Line</span>
          <kbd className={kbd}>{route === 'elbow' ? 'X' : 'L'}</kbd>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          className="min-w-40">
          <DropdownMenuItem
            onClick={() =>
              props.onTool({ type: 'connector', route: 'straight' })
            }>
            Straight
            <DropdownMenuShortcut>L</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              props.onTool({ type: 'connector', route: 'elbow' })
            }>
            Elbow
            <DropdownMenuShortcut>X</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              props.onTool({ type: 'connector', route: 'curved' })
            }>
            Curve
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) props.onPickImages(files);
        }}
      />
      <button
        type="button"
        className={btn}
        title="Image"
        onClick={() => fileRef.current?.click()}>
        <HugeiconsIcon
          icon={Image01Icon}
          size={16}
          strokeWidth={2}
        />
        <span className="max-sm:hidden">Image</span>
      </button>
      <button
        type="button"
        className={btn}
        aria-pressed={props.tool.type === 'section'}
        title="Section"
        onClick={() => props.onTool({ type: 'section' })}>
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          aria-hidden
          className="overflow-visible">
          <rect
            x={1.5}
            y={3}
            width={13}
            height={10}
            rx={1.5}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
          />
        </svg>
        <span className="max-sm:hidden">Section</span>
      </button>
      <button
        type="button"
        className={
          btn +
          ' aria-pressed:bg-zinc-900 aria-pressed:text-stone-100 aria-pressed:[&_kbd]:text-current aria-pressed:[&_kbd]:opacity-70'
        }
        aria-pressed={props.askOpen}
        title="Ask (⌘K)"
        onClick={props.onAsk}>
        Ask{' '}
        <kbd className={kbd}>&#8984;K</kbd>
      </button>
      <span className="mx-1 h-5 w-px shrink-0 bg-stone-100" />
      <button
        type="button"
        className={btn}
        aria-pressed={props.snapGrid}
        title="Snap to grid"
        onClick={() => props.onSnapGrid(!props.snapGrid)}>
        Grid
      </button>
      {props.onSeed && (
        <button
          type="button"
          className={btn}
          title="Add 2,000 items"
          onClick={props.onSeed}>
          2k
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex min-w-[54px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent px-2.5 py-1.5 font-mono text-xs font-medium whitespace-nowrap text-zinc-500 tabular-nums hover:bg-zinc-900/10 aria-expanded:bg-zinc-900 aria-expanded:text-stone-100 max-sm:px-2"
          title="Zoom">
          {Math.round(props.zoom * 100)}%
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          className="min-w-44">
          <DropdownMenuItem onClick={() => props.onZoomBy(1.25)}>
            Zoom in
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => props.onZoomBy(1 / 1.25)}>
            Zoom out
          </DropdownMenuItem>
          <DropdownMenuItem onClick={props.onZoom100}>
            Zoom to 100%
            <DropdownMenuShortcut>⇧0</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={props.onFit}>
            Zoom to fit
            <DropdownMenuShortcut>⇧1</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={props.onFrameSelection}>
            Zoom to selection
            <DropdownMenuShortcut>⇧2</DropdownMenuShortcut>
          </DropdownMenuItem>
          {props.sections.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {props.sections.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  className="max-w-56 truncate"
                  onClick={() => props.onJumpSection(s.id)}>
                  {s.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </Island>
  );
}
