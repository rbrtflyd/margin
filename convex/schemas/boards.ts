import { defineTable } from 'convex/server';
import { v } from 'convex/values';

const sideValidator = v.union(
  v.literal('n'),
  v.literal('e'),
  v.literal('s'),
  v.literal('w'),
);

const fillValidator = v.union(
  v.literal('white'),
  v.literal('stone'),
  v.literal('amber'),
  v.literal('orange'),
  v.literal('yellow'),
  v.literal('lime'),
  v.literal('teal'),
  v.literal('sky'),
  v.literal('violet'),
  v.literal('fuchsia'),
  v.literal('rose'),
  v.literal('red'),
);

const anchorValidator = v.union(
  v.object({
    itemId: v.string(),
    side: v.union(sideValidator, v.literal('auto')),
  }),
  v.object({ x: v.number(), y: v.number() }),
);

const arrowValidator = v.union(
  v.literal('none'),
  v.literal('arrow'),
  v.literal('triangle'),
  v.literal('circle'),
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
      v.literal('image'),
      v.literal('link'),
      v.literal('embed'),
      v.literal('section'),
    ),
  ),
  shape: v.optional(
    v.union(
      v.literal('rect'),
      v.literal('ellipse'),
      v.literal('diamond'),
      v.literal('triangle'),
      v.literal('roundRect'),
      v.literal('parallelogram'),
      v.literal('cylinder'),
      v.literal('document'),
      v.literal('hexagon'),
      v.literal('star'),
      v.literal('chevron'),
      v.literal('speech'),
    ),
  ),
  fill: v.optional(v.union(fillValidator, v.literal('none'))),
  stroke: v.optional(v.union(fillValidator, v.literal('ink'), v.literal('none'))),
  strokeWidth: v.optional(v.union(v.literal(1), v.literal(2), v.literal(4))),
  strokeStyle: v.optional(
    v.union(v.literal('solid'), v.literal('dashed'), v.literal('dotted')),
  ),
  textColor: v.optional(v.union(fillValidator, v.literal('ink'))),
  fontSize: v.optional(
    v.union(v.literal('s'), v.literal('m'), v.literal('l'), v.literal('xl')),
  ),
  align: v.optional(
    v.union(v.literal('left'), v.literal('center'), v.literal('right')),
  ),
  locked: v.optional(v.boolean()),
  groupId: v.optional(v.string()),
  route: v.optional(
    v.union(v.literal('straight'), v.literal('elbow'), v.literal('curved')),
  ),
  bend: v.optional(v.number()),
  labelAt: v.optional(v.number()),
  arrowStart: v.optional(arrowValidator),
  arrowEnd: v.optional(arrowValidator),
  start: v.optional(anchorValidator),
  end: v.optional(anchorValidator),
  assetId: v.optional(v.string()),
  url: v.optional(v.string()),
  meta: v.optional(
    v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      siteName: v.optional(v.string()),
      thumb: v.optional(v.string()),
      provider: v.optional(v.string()),
    }),
  ),
  caption: v.optional(v.string()),
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
