import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { askValidator, boardFieldsValidator, itemValidator, viewValidator } from '../schemas/boards';
import { readStore, requireUserId, setCurrent, toBoard } from './_lib';

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await readStore(ctx, userId);
    if (existing) return existing;

    const t = new Date().toISOString();
    const id = await ctx.db.insert('boards', {
      userId,
      name: 'Untitled board',
      items: [],
      view: null,
      asks: [],
      createdAt: t,
      updatedAt: t,
    });
    await setCurrent(ctx, userId, id);
    return await readStore(ctx, userId);
  },
});

export const create = mutation({
  args: {
    name: v.optional(v.string()),
    items: v.optional(v.array(itemValidator)),
    view: v.optional(v.union(viewValidator, v.null())),
    asks: v.optional(v.array(askValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const t = new Date().toISOString();
    const id = await ctx.db.insert('boards', {
      userId,
      name: args.name?.trim() || 'Untitled board',
      items: args.items ?? [],
      view: args.view ?? null,
      asks: args.asks ?? [],
      createdAt: t,
      updatedAt: t,
    });
    await setCurrent(ctx, userId, id);
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error('Board insert failed.');
    return toBoard(doc);
  },
});

export const save = mutation({
  args: {
    boards: v.array(
      v.object({
        id: v.id('boards'),
        ...boardFieldsValidator.fields,
      }),
    ),
    currentId: v.id('boards'),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    for (const b of args.boards) {
      const doc = await ctx.db.get(b.id);
      if (!doc || doc.userId !== userId) continue;
      const { id: _id, ...fields } = b;
      await ctx.db.patch(b.id, fields);
    }
    const current = await ctx.db.get(args.currentId);
    if (current && current.userId === userId) await setCurrent(ctx, userId, args.currentId);
  },
});

export const remove = mutation({
  args: { id: v.id('boards') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const docs = await ctx.db
      .query('boards')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    if (docs.length < 2) return;
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return;
    await ctx.db.delete(args.id);
    const next = docs.find((d) => d._id !== args.id);
    if (next) await setCurrent(ctx, userId, next._id);
  },
});
