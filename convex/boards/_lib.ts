import type { Doc, Id } from '../_generated/dataModel';
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

export async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity.subject;
}

export async function readStore(ctx: QueryCtx | MutationCtx, userId: string) {
  const docs = await ctx.db
    .query('boards')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  if (docs.length === 0) return null;
  const boards = docs.map(toBoard);
  const ws = await ctx.db
    .query('workspace')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
  const currentId =
    ws && boards.some((b) => b.id === ws.currentBoardId) ? (ws.currentBoardId as string) : boards[0].id;
  return { v: 1 as const, boards, currentId };
}

export async function setCurrent(ctx: MutationCtx, userId: string, id: Id<'boards'>) {
  const ws = await ctx.db
    .query('workspace')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
  if (ws) await ctx.db.patch(ws._id, { currentBoardId: id });
  else await ctx.db.insert('workspace', { userId, currentBoardId: id });
}
