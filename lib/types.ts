export type Author = 'me' | 'claude';

/** The signed-in person. */
export interface User {
  id: string;
  name: string;
  email: string;
}

/** The one primitive: a free text box. It can hold an idea, a question, a quote, a link, anything. */
export interface Item {
  id: string;
  x: number;
  y: number;
  /** Optional fixed width in world units. Unset means the box sizes to its text, up to a max. */
  w?: number;
  text: string;
  by: Author;
  createdAt: string;
  editedAt: string;
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
