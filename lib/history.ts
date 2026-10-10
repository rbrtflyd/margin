export type HistorySnap<T> = {
  past: T[];
  coalesceKey?: string;
  at?: number;
};

/** Same coalesce key within `windowMs` reuses the last undo snapshot instead of pushing. */
export function nextHistory<T>(
  state: HistorySnap<T>,
  snapshot: T,
  coalesceKey: string | undefined,
  now: number,
  windowMs = 500,
): HistorySnap<T> {
  if (
    coalesceKey &&
    state.coalesceKey === coalesceKey &&
    state.at !== undefined &&
    now - state.at < windowMs &&
    state.past.length > 0
  ) {
    return { past: state.past, coalesceKey, at: now };
  }
  return {
    past: [...state.past, snapshot],
    coalesceKey,
    at: now,
  };
}
