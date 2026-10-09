import { query } from '../_generated/server';
import { readStore } from './_lib';

export const getStore = query({
  args: {},
  handler: async (ctx) => readStore(ctx),
});
