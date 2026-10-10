import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  Align,
  Anchor,
  Author,
  Fill,
  FontSize,
  Handle,
  Item,
  ItemKind,
  Route,
  ShapeKind,
  Side,
  Stroke,
  StrokeStyle,
  StrokeWidth,
  Tool,
  View,
} from '@/lib/types';
import type { ItemStyle, Rect } from '@/lib/items';
import type { ArrangeOp, Guides } from '@/lib/align';
import type { Pt } from '@/lib/connectors';

export type CreateDraft = {
  kind?: ItemKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  by?: Author;
  assetId?: string;
  caption?: string;
  url?: string;
  shape?: ShapeKind;
  fill?: Fill | 'none';
  stroke?: Stroke;
  strokeWidth?: StrokeWidth;
  strokeStyle?: StrokeStyle;
  textColor?: Fill | 'ink';
  fontSize?: FontSize;
  align?: Align;
  route?: Route;
  start?: Anchor;
  end?: Anchor;
  edit?: boolean;
};

export type { Pt, Rect };

export type ResizeLive = {
  ids: string[];
  from: Rect;
  to: Rect;
};

export type Drag =
  | {
      kind: 'pan';
      sx: number;
      sy: number;
      vx: number;
      vy: number;
      moved: boolean;
    }
  | {
      kind: 'move';
      sx: number;
      sy: number;
      ids: string[];
      clickId: string;
      wasSelected: boolean;
      shift: boolean;
      duplicate: boolean;
      moved: boolean;
    }
  | {
      kind: 'marquee';
      sx: number;
      sy: number;
      base: Set<string>;
      moved: boolean;
    }
  | {
      kind: 'place';
      sx: number;
      sy: number;
      wx: number;
      wy: number;
      moved: boolean;
    }
  | {
      kind: 'connector';
      start: Anchor;
      moved: boolean;
    }
  | {
      kind: 'resize';
      ids: string[];
      handle: Handle;
      sx: number;
      sy: number;
      x: number;
      y: number;
      w: number;
      h: number;
      moved: boolean;
    }
  | {
      kind: 'endpoint';
      id: string;
      which: 'start' | 'end';
      moved: boolean;
    }
  | {
      kind: 'bend';
      id: string;
      axis: 'x' | 'y';
      sx: number;
      sy: number;
      wx: number;
      wy: number;
      origin: number;
      moved: boolean;
    }
  | {
      kind: 'label';
      id: string;
      moved: boolean;
    };

export type CanvasProps = {
  items: Item[];
  selected: Set<string>;
  tool: Tool;
  stickyStyle: ItemStyle;
  shapeStyle: ItemStyle;
  textStyle: ItemStyle;
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
  snapGrid: boolean;
};

export type InteractionCtx = {
  viewRef: RefObject<View>;
  propsRef: RefObject<CanvasProps>;
  dragRef: RefObject<Drag | null>;
  els: RefObject<Map<string, Element>>;
  previewRef: RefObject<Set<string> | null>;
  lastTap: RefObject<{ t: number; x: number; y: number } | null>;
  setView: Dispatch<SetStateAction<View>>;
  setDragging: Dispatch<
    SetStateAction<{ ids: Set<string>; x: number; y: number } | null>
  >;
  setPanning: Dispatch<SetStateAction<boolean>>;
  setPlaceBox: Dispatch<SetStateAction<Rect | null>>;
  setDraftLine: Dispatch<
    SetStateAction<{ start: Anchor; end: Anchor } | null>
  >;
  setResize: Dispatch<SetStateAction<ResizeLive | null>>;
  setEndDraft: Dispatch<
    SetStateAction<{
      id: string;
      which: 'start' | 'end';
      anchor: Anchor;
    } | null>
  >;
  setMarquee: Dispatch<
    SetStateAction<{ x0: number; y0: number; x1: number; y1: number } | null>
  >;
  setPreview: Dispatch<SetStateAction<Set<string> | null>>;
  setGuides: Dispatch<SetStateAction<Guides | null>>;
  toWorld(clientX: number, clientY: number): Pt;
  currentRects(): Map<string, Rect>;
  rootRect(): DOMRect | null;
};

export function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.isContentEditable ||
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT'
  );
}
