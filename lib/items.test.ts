import { afterEach, describe, expect, it } from 'vitest';
import {
  applyResize,
  boundsOf,
  forgetSize,
  rememberSize,
  STICKY_SIZE,
} from './items';
import type { Item } from './types';

afterEach(() => {
  forgetSize('t1');
  forgetSize('st1');
});

function box(partial: Partial<Item> & Pick<Item, 'id'>): Item {
  return {
    x: 10,
    y: 20,
    text: '',
    by: 'me',
    createdAt: '2020-01-01T00:00:00.000Z',
    editedAt: '2020-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('applyResize', () => {
  const start = { x: 0, y: 0, w: 100, h: 80 };

  it('grows from the east handle', () => {
    expect(applyResize(start, 'e', 20, 0, false)).toEqual({
      x: 0,
      y: 0,
      w: 120,
      h: 80,
    });
  });

  it('moves the origin when resizing from the west', () => {
    expect(applyResize(start, 'w', 20, 0, false)).toEqual({
      x: 20,
      y: 0,
      w: 80,
      h: 80,
    });
  });

  it('keeps the aspect ratio on a corner handle', () => {
    expect(applyResize(start, 'se', 20, 5, true)).toEqual({
      x: 0,
      y: 0,
      w: 120,
      h: 96,
    });
  });

  it('does not shrink below the minimum size', () => {
    expect(applyResize(start, 'e', -200, 0, false).w).toBe(40);
  });
});

describe('boundsOf', () => {
  it('uses stored w and h when they are set', () => {
    expect(boundsOf(box({ id: 't1', w: 240, h: 50 }))).toEqual({
      x: 10,
      y: 20,
      w: 240,
      h: 50,
    });
  });

  it('uses the measured size when w and h are unset', () => {
    rememberSize('t1', 88, 22);
    expect(boundsOf(box({ id: 't1' }))).toEqual({ x: 10, y: 20, w: 88, h: 22 });
  });

  it('falls back to the sticky default when nothing is stored or measured', () => {
    expect(boundsOf(box({ id: 'st1', kind: 'sticky' }))).toEqual({
      x: 10,
      y: 20,
      w: STICKY_SIZE,
      h: STICKY_SIZE,
    });
  });
});
