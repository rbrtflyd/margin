import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

export function toBoard(doc: Doc<'boards'>) {
  return {
    id: doc._id as string,
    name: doc.name,
    items: doc.items,
    view: doc.view,
    asks: doc.asks,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function readStore(ctx: QueryCtx | MutationCtx) {
  const docs = await ctx.db.query('boards').collect();
  if (docs.length === 0) return null;
  const boards = docs.map(toBoard);
  const ws = await ctx.db.query('workspace').first();
  const currentId =
    ws && boards.some((b) => b.id === ws.currentBoardId) ? (ws.currentBoardId as string) : boards[0].id;
  return { v: 1 as const, boards, currentId };
}
