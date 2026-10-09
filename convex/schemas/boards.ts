import { defineTable } from 'convex/server';
import { v } from 'convex/values';

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

export const boardFieldsValidator = v.object({
  name: v.string(),
  items: v.array(itemValidator),
  view: v.union(viewValidator, v.null()),
  asks: v.array(askValidator),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const boards = defineTable({
  userId: v.string(),
  ...boardFieldsValidator.fields,
}).index('by_user', ['userId']);
