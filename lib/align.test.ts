import { describe, expect, it } from 'vitest';
import {
  alignItems,
  arrangeItems,
  distributeItems,
  snapGrid,
  snapRect,
  tidyItems,
} from './align';
import type { Item } from './types';

function box(partial: Partial<Item> & Pick<Item, 'id' | 'x' | 'y'>): Item {
  return {
    text: '',
    by: 'me',
    createdAt: '2020-01-01T00:00:00.000Z',
    editedAt: '2020-01-01T00:00:00.000Z',
    w: 40,
    h: 20,
    kind: 'shape',
    shape: 'rect',
    ...partial,
  };
}

describe('alignItems', () => {
  it('aligns left to the leftmost box', () => {
    const a = box({ id: 'a', x: 10, y: 0 });
    const b = box({ id: 'b', x: 50, y: 30 });
    const next = alignItems([a, b], ['a', 'b'], 'left');
    expect(next.find((i) => i.id === 'a')?.x).toBe(10);
    expect(next.find((i) => i.id === 'b')?.x).toBe(10);
  });

  it('aligns centers horizontally', () => {
    const a = box({ id: 'a', x: 0, y: 0, w: 40 });
    const b = box({ id: 'b', x: 80, y: 0, w: 20 });
    const next = alignItems([a, b], ['a', 'b'], 'center');
    const na = next.find((i) => i.id === 'a')!;
    const nb = next.find((i) => i.id === 'b')!;
    expect(na.x + 20).toBe(nb.x + 10);
  });
});

describe('distributeItems', () => {
  it('spaces three boxes with equal gaps', () => {
    const a = box({ id: 'a', x: 0, y: 0, w: 10 });
    const b = box({ id: 'b', x: 20, y: 0, w: 10 });
    const c = box({ id: 'c', x: 90, y: 0, w: 10 });
    const next = distributeItems([a, b, c], ['a', 'b', 'c'], 'horizontal');
    const xs = next.map((i) => i.x);
    expect(xs[0]).toBe(0);
    expect(xs[2]).toBe(90);
    expect(xs[1]).toBe(45);
  });
});

describe('tidyItems', () => {
  it('lays boxes out in a row-major grid', () => {
    const items = [
      box({ id: 'a', x: 5, y: 40, w: 40, h: 20 }),
      box({ id: 'b', x: 80, y: 8, w: 40, h: 20 }),
      box({ id: 'c', x: 12, y: 90, w: 40, h: 20 }),
    ];
    const next = tidyItems(items, ['a', 'b', 'c']);
    const byId = Object.fromEntries(next.map((i) => [i.id, i]));
    expect(byId.b.y).toBe(byId.a.y);
    expect(byId.c.y).toBeGreaterThan(byId.a.y);
  });
});

describe('arrangeItems', () => {
  it('routes tidy through arrangeItems', () => {
    const a = box({ id: 'a', x: 0, y: 0 });
    const b = box({ id: 'b', x: 80, y: 0 });
    expect(arrangeItems([a, b], ['a', 'b'], 'left')[1].x).toBe(0);
  });
});

describe('snapGrid', () => {
  it('rounds to 24', () => {
    expect(snapGrid(0)).toBe(0);
    expect(snapGrid(13)).toBe(24);
    expect(snapGrid(11)).toBe(0);
  });
});

describe('snapRect', () => {
  it('snaps a moving left edge to a neighbor', () => {
    const moving = { x: 102, y: 0, w: 40, h: 20 };
    const other = { x: 0, y: 0, w: 100, h: 20 };
    const s = snapRect(moving, [other], 6, false);
    expect(s.dx).toBe(-2);
    expect(s.guides.v).toContain(100);
  });
});
