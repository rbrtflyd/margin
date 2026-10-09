import { defineSchema } from 'convex/server';
import { boards } from './schemas/boards';
import { workspace } from './schemas/workspace';

export default defineSchema({
  boards,
  workspace,
});
