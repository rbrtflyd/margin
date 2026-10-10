'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  CircleIcon,
  Cursor01Icon,
  DiamondIcon,
  LineIcon,
  SquareIcon,
  SquareRoundCornerIcon,
  StickyNote01Icon,
  TextIcon,
  TriangleIcon,
} from '@hugeicons/core-free-icons';
import type { Route, ShapeKind, Tool } from '@/lib/types';
import { SHAPES } from '@/lib/items';
import { Island } from './Island';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const btn =
  'inline-flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 py-1.5 text-[13.5px] whitespace-nowrap hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100 aria-pressed:[&_kbd]:text-current aria-pressed:[&_kbd]:opacity-70 max-sm:px-1.5';
const kbd = 'font-mono text-[10.5px] font-medium text-zinc-400 max-sm:hidden';

const shapeIcon: Record<ShapeKind, typeof SquareIcon> = {
  rect: SquareIcon,
  ellipse: CircleIcon,
  diamond: DiamondIcon,
  triangle: TriangleIcon,
  roundRect: SquareRoundCornerIcon,
};

interface Props {
  zoom: number;
  askOpen: boolean;
  tool: Tool;
  onTool(tool: Tool): void;
  onAsk(): void;
  onFit(): void;
}

export default function CanvasToolbar(props: Props) {
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
          <HugeiconsIcon
            icon={shapeIcon[shape]}
            size={16}
            strokeWidth={2}
          />
          <span className="max-sm:hidden">Shape</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          className="min-w-40">
          {SHAPES.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => props.onTool({ type: 'shape', shape: s.id })}>
              <HugeiconsIcon
                icon={shapeIcon[s.id]}
                size={16}
                strokeWidth={2}
              />
              {s.label}
              {s.shortcut && (
                <DropdownMenuShortcut>{s.shortcut}</DropdownMenuShortcut>
              )}
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
        </DropdownMenuContent>
      </DropdownMenu>
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
        className="inline-flex min-w-[54px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent px-2.5 py-1.5 font-mono text-xs font-medium whitespace-nowrap text-zinc-500 tabular-nums hover:bg-zinc-900/10 max-sm:px-2"
        title="Zoom to fit (Shift+1)"
        onClick={props.onFit}>
        {Math.round(props.zoom * 100)}%
      </button>
    </Island>
  );
}
