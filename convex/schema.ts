import { defineSchema } from 'convex/server';
import { assets } from './schemas/assets';
import { boards } from './schemas/boards';
import { workspace } from './schemas/workspace';

export default defineSchema({
  assets,
  boards,
  workspace,
});
