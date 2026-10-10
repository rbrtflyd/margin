import { describe, expect, it } from 'vitest';
import { nextHistory, type HistorySnap } from './history';

describe('nextHistory', () => {
  it('coalesces three commits with the same key 100ms apart into one past entry', () => {
    let s: HistorySnap<string> = { past: [] };
    s = nextHistory(s, 'before-1', 'nudge', 0);
    s = nextHistory(s, 'before-2', 'nudge', 100);
    s = nextHistory(s, 'before-3', 'nudge', 200);
    expect(s.past).toEqual(['before-1']);
  });

  it('pushes a new entry when the key differs', () => {
    let s: HistorySnap<string> = { past: [] };
    s = nextHistory(s, 'a', 'nudge', 0);
    s = nextHistory(s, 'b', 'fill', 100);
    expect(s.past).toEqual(['a', 'b']);
  });

  it('pushes a new entry when the key is absent', () => {
    let s: HistorySnap<string> = { past: [] };
    s = nextHistory(s, 'a', undefined, 0);
    s = nextHistory(s, 'b', undefined, 100);
    expect(s.past).toEqual(['a', 'b']);
  });

  it('pushes a new entry after the coalesce window', () => {
    let s: HistorySnap<string> = { past: [] };
    s = nextHistory(s, 'a', 'nudge', 0);
    s = nextHistory(s, 'b', 'nudge', 500);
    expect(s.past).toEqual(['a', 'b']);
  });
});
