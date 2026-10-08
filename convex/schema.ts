import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

export const itemValidator = v.object({
  id: v.string(),
  x: v.number(),
  y: v.number(),
  w: v.optional(v.number()),
  text: v.string(),
  by: v.union(v.literal('me'), v.literal('claude')),
  createdAt: v.string(),
  editedAt: v.string(),
});

export const viewValidator = v.object({
  x: v.number(),
  y: v.number(),
  k: v.number(),
});

export const askValidator = v.object({
  id: v.string(),
  q: v.string(),
  a: v.string(),
  at: v.string(),
  scope: v.number(),
  status: v.union(v.literal('done'), v.literal('error'), v.literal('stopped')),
});

export const boardValidator = v.object({
  id: v.string(),
  name: v.string(),
  items: v.array(itemValidator),
  view: v.union(viewValidator, v.null()),
  asks: v.array(askValidator),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const storeValidator = {
  v: v.literal(1),
  boards: v.array(boardValidator),
  currentId: v.string(),
};

export default defineSchema({
  ...authTables,
  stores: defineTable({
    userId: v.id('users'),
    ...storeValidator,
  }).index('by_user', ['userId']),
});
