import { v } from 'convex/values';
import { isGcCandidate, referencedAssetIds } from '../lib/images';
import { internalMutation, mutation, query } from './_generated/server';
import { requireUserId } from './boards/_lib';

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query('assets')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first();
    if (existing) {
      if (existing.userId !== userId) throw new Error('Not authenticated');
      return existing.storageId;
    }
    await ctx.db.insert('assets', {
      userId,
      storageId,
      createdAt: new Date().toISOString(),
    });
    return storageId;
  },
});

export const urls = query({
  args: { ids: v.array(v.id('_storage')) },
  handler: async (ctx, { ids }) => {
    const userId = await requireUserId(ctx);
    const owned = await ctx.db
      .query('assets')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const mine = new Set(owned.map((row) => row.storageId as string));
    const out: Record<string, string> = {};
    for (const id of ids) {
      if (!mine.has(id)) continue;
      const url = await ctx.storage.getUrl(id);
      if (url) out[id] = url;
    }
    return out;
  },
});

export const gc = internalMutation({
  args: {},
  handler: async (ctx) => {
    const boards = await ctx.db.query('boards').collect();
    const referenced = referencedAssetIds(boards.flatMap((b) => b.items));
    const now = Date.now();
    const assets = await ctx.db.query('assets').collect();
    for (const row of assets) {
      if (!isGcCandidate(row.storageId, row.createdAt, referenced, now)) continue;
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete(row._id);
    }
  },
});
