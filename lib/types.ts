export type Author = 'me' | 'claude';

/** The signed-in person. */
export interface User {
  id: string;
  name: string;
  email: string;
}

export type ItemKind =
  | 'text'
  | 'sticky'
  | 'shape'
  | 'connector'
  | 'image'
  | 'link'
  | 'embed'
  | 'section';
export type ShapeKind = 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'roundRect';
export type Fill = 'amber' | 'rose' | 'sky' | 'lime' | 'stone' | 'white';
export type Stroke = Fill | 'ink' | 'none';
export type StrokeWidth = 1 | 2 | 4;
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FontSize = 's' | 'm' | 'l' | 'xl';
export type Align = 'left' | 'center' | 'right';
export type Route = 'straight' | 'elbow' | 'curved';
export type Side = 'n' | 'e' | 's' | 'w';
export type Handle = Side | 'ne' | 'nw' | 'se' | 'sw';
export type Arrowhead = 'none' | 'arrow' | 'triangle' | 'circle';

export type Anchor =
  | { itemId: string; side: Side | 'auto' }
  | { x: number; y: number };

export type LinkMeta = {
  title?: string;
  description?: string;
  siteName?: string;
  thumb?: string;
  provider?: string;
};

export type Tool =
  | { type: 'select' }
  | { type: 'text' }
  | { type: 'sticky' }
  | { type: 'shape'; shape: ShapeKind }
  | { type: 'connector'; route: Route };

/** A board object. Missing kind means a text box. */
export interface Item {
  id: string;
  x: number;
  y: number;
  /** Optional fixed width in world units. Unset means the box sizes to its text, up to a max. */
  w?: number;
  h?: number;
  text: string;
  by: Author;
  createdAt: string;
  editedAt: string;
  kind?: ItemKind;
  shape?: ShapeKind;
  fill?: Fill | 'none';
  stroke?: Stroke;
  strokeWidth?: StrokeWidth;
  strokeStyle?: StrokeStyle;
  textColor?: Fill | 'ink';
  fontSize?: FontSize;
  align?: Align;
  locked?: boolean;
  groupId?: string;
  route?: Route;
  bend?: number;
  labelAt?: number;
  arrowStart?: Arrowhead;
  arrowEnd?: Arrowhead;
  start?: Anchor;
  end?: Anchor;
  assetId?: string;
  url?: string;
  meta?: LinkMeta;
  caption?: string;
}

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface AskTurn {
  id: string;
  q: string;
  a: string;
  at: string;
  /** How many boxes the assistant was reading for this turn. */
  scope: number;
  status: 'done' | 'error' | 'stopped';
}

export interface Board {
  id: string;
  name: string;
  items: Item[];
  view: View | null;
  asks: AskTurn[];
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  v: 1;
  boards: Board[];
  currentId: string;
}

/** What the client sends to /api/ask. */
export interface AskRequest {
  question: string;
  boardName: string;
  items: { id: string; text: string; x: number; y: number; by: Author }[];
  selectedIds: string[];
  history: { q: string; a: string }[];
}
