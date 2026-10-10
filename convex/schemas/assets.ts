import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const assets = defineTable({
  userId: v.string(),
  storageId: v.id('_storage'),
  createdAt: v.string(),
})
  .index('by_user', ['userId'])
  .index('by_storage', ['storageId']);
