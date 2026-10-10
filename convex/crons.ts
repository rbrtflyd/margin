import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.daily(
  'gc unreferenced assets',
  { hourUTC: 7 },
  internal.assets.gc,
);

export default crons;
