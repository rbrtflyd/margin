import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { askValidator, boardFieldsValidator, itemValidator, viewValidator } from '../schemas/boards';
import { readStore, toBoard } from './_lib';

const migratedBoardValidator = v.object({
  id: v.string(),
  ...boardFieldsValidator.fields,
});

async function setCurrent(ctx: MutationCtx, id: Id<'boards'>) {
  const ws = await ctx.db.query('workspace').first();
  if (ws) await ctx.db.patch(ws._id, { currentBoardId: id });
  else await ctx.db.insert('workspace', { currentBoardId: id });
}

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('boards').first();
    if (existing) return await readStore(ctx);

    const t = new Date().toISOString();
    const id = await ctx.db.insert('boards', {
      name: 'Untitled board',
      items: [],
      view: null,
      asks: [],
      createdAt: t,
      updatedAt: t,
    });
    await setCurrent(ctx, id);
    return await readStore(ctx);
  },
});

export const migrate = mutation({
  args: {
    boards: v.array(migratedBoardValidator),
    currentId: v.string(),
  },
  handler: async (ctx, args) => {
    if ((await ctx.db.query('boards').first()) || args.boards.length === 0) {
      return await readStore(ctx);
    }

    const ids = new Map<string, Id<'boards'>>();
    for (const b of args.boards) {
      const id = await ctx.db.insert('boards', {
        name: b.name,
        items: b.items,
        view: b.view,
        asks: b.asks,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      });
      ids.set(b.id, id);
    }
    const currentId = ids.get(args.currentId) ?? [...ids.values()][0];
    await setCurrent(ctx, currentId);
    return await readStore(ctx);
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
    const t = new Date().toISOString();
    const id = await ctx.db.insert('boards', {
      name: args.name?.trim() || 'Untitled board',
      items: args.items ?? [],
      view: args.view ?? null,
      asks: args.asks ?? [],
      createdAt: t,
      updatedAt: t,
    });
    await setCurrent(ctx, id);
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
    for (const b of args.boards) {
      const doc = await ctx.db.get(b.id);
      if (!doc) continue;
      const { id: _id, ...fields } = b;
      await ctx.db.patch(b.id, fields);
    }
    if (await ctx.db.get(args.currentId)) await setCurrent(ctx, args.currentId);
  },
});

export const remove = mutation({
  args: { id: v.id('boards') },
  handler: async (ctx, args) => {
    const docs = await ctx.db.query('boards').collect();
    if (docs.length < 2) return;
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    await ctx.db.delete(args.id);
    const next = docs.find((d) => d._id !== args.id);
    if (next) await setCurrent(ctx, next._id);
  },
});
