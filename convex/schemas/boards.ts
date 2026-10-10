import { defineTable } from 'convex/server';
import { v } from 'convex/values';

const sideValidator = v.union(
  v.literal('n'),
  v.literal('e'),
  v.literal('s'),
  v.literal('w'),
);

const anchorValidator = v.union(
  v.object({ itemId: v.string(), side: sideValidator }),
  v.object({ x: v.number(), y: v.number() }),
);

export const itemValidator = v.object({
  id: v.string(),
  x: v.number(),
  y: v.number(),
  w: v.optional(v.number()),
  h: v.optional(v.number()),
  text: v.string(),
  by: v.union(v.literal('me'), v.literal('claude')),
  createdAt: v.string(),
  editedAt: v.string(),
  kind: v.optional(
    v.union(
      v.literal('text'),
      v.literal('sticky'),
      v.literal('shape'),
      v.literal('connector'),
    ),
  ),
  shape: v.optional(
    v.union(
      v.literal('rect'),
      v.literal('ellipse'),
      v.literal('diamond'),
      v.literal('triangle'),
      v.literal('roundRect'),
    ),
  ),
  fill: v.optional(
    v.union(
      v.literal('amber'),
      v.literal('rose'),
      v.literal('sky'),
      v.literal('lime'),
      v.literal('stone'),
      v.literal('white'),
    ),
  ),
  route: v.optional(v.union(v.literal('straight'), v.literal('elbow'))),
  start: v.optional(anchorValidator),
  end: v.optional(anchorValidator),
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
