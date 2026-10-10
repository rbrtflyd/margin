import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  Anchor,
  Author,
  Fill,
  Handle,
  Item,
  ItemKind,
  Route,
  ShapeKind,
  Tool,
  View,
} from '@/lib/types';
import type { Rect } from '@/lib/items';
import type { Pt } from '@/lib/connectors';

export type CreateDraft = {
  kind?: ItemKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  by?: Author;
  shape?: ShapeKind;
  fill?: Fill;
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
    };

export type CanvasProps = {
  items: Item[];
  selected: Set<string>;
  tool: Tool;
  stickyFill: Fill;
  onSelect(ids: Set<string>): void;
  onMove(ids: string[], dx: number, dy: number): void;
  onDuplicateMove(ids: string[], dx: number, dy: number): void;
  onCreate(draft: CreateDraft): void;
  onResize(id: string, box: Rect, handle: Handle): void;
  onResizeAll(ids: string[], from: Rect, to: Rect): void;
  onPatch(id: string, patch: Partial<Item>): void;
  onPatchAll(patch: Partial<Item>, coalesceKey?: string): void;
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
