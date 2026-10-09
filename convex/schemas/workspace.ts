import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const workspace = defineTable({
  currentBoardId: v.id('boards'),
});
