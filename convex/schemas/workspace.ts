import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const workspace = defineTable({
  userId: v.string(),
  currentBoardId: v.id('boards'),
}).index('by_user', ['userId']);
