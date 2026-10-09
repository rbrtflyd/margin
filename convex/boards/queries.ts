import { query } from '../_generated/server';
import { readStore } from './_lib';

export const getStore = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return readStore(ctx, identity.subject);
  },
});
