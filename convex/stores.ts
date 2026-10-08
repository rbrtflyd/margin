import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query } from './_generated/server';
import { storeValidator } from './schema';

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query('stores')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!row) return null;
    return { v: row.v, boards: row.boards, currentId: row.currentId };
  },
});

export const save = mutation({
  args: storeValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');
    if (!args.boards.length) throw new Error('Need at least one board');
    if (!args.boards.some((b) => b.id === args.currentId)) {
      throw new Error('currentId must match a board');
    }
    const existing = await ctx.db
      .query('stores')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        v: args.v,
        boards: args.boards,
        currentId: args.currentId,
      });
    } else {
      await ctx.db.insert('stores', {
        userId,
        v: args.v,
        boards: args.boards,
        currentId: args.currentId,
      });
    }
  },
});
