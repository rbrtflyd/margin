import { afterEach, describe, expect, it } from 'vitest';
import {
  applyResize,
  boundsOf,
  FILLS,
  forgetSize,
  mapBox,
  paintOf,
  rememberSize,
  scaleItem,
  STICKY_SIZE,
  strokeOf,
  textInk,
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

  it('grows from the center when fromCenter is set', () => {
    expect(applyResize(start, 'e', 10, 0, false, 40, true)).toEqual({
      x: -10,
      y: 0,
      w: 120,
      h: 80,
    });
    expect(applyResize(start, 'se', 10, 8, false, 40, true)).toEqual({
      x: -10,
      y: -8,
      w: 120,
      h: 96,
    });
  });

  it('keeps ratio from the center on a corner handle', () => {
    expect(applyResize(start, 'se', 20, 5, true, 40, true)).toEqual({
      x: -20,
      y: -16,
      w: 140,
      h: 112,
    });
  });
});

describe('mapBox', () => {
  it('scales a box about the union origin', () => {
    const from = { x: 0, y: 0, w: 200, h: 100 };
    const to = { x: 0, y: 0, w: 400, h: 100 };
    expect(mapBox(from, to, { x: 50, y: 10, w: 40, h: 20 })).toEqual({
      x: 100,
      y: 10,
      w: 80,
      h: 20,
    });
  });
});

describe('scaleItem', () => {
  it('scales a free connector end and leaves attached ends', () => {
    const c = box({
      id: 'c1',
      kind: 'connector',
      start: { itemId: 'n', side: 'e' },
      end: { x: 50, y: 20 },
    });
    const next = scaleItem(
      c,
      { x: 0, y: 0, w: 100, h: 40 },
      { x: 0, y: 0, w: 200, h: 40 },
    );
    expect(next.start).toEqual({ itemId: 'n', side: 'e' });
    expect(next.end).toEqual({ x: 100, y: 20 });
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

describe('paintOf', () => {
  it('forces Claude items to sky even when fill is set', () => {
    const p = paintOf(box({ id: 'c1', by: 'claude', fill: 'rose' }));
    expect(p.bg).toBe(FILLS.sky.bg);
    expect(p.claude).toBe(true);
  });

  it('treats fill none as a transparent fill', () => {
    const p = paintOf(box({ id: 's1', kind: 'shape', fill: 'none' }));
    expect(p.fillNone).toBe(true);
    expect(p.bg).toBe('none');
  });
});

describe('strokeOf', () => {
  it('returns null when stroke is none', () => {
    expect(strokeOf(box({ id: 's1', kind: 'shape', stroke: 'none' }))).toBeNull();
  });

  it('uses dashed marks when strokeStyle is dashed', () => {
    const s = strokeOf(
      box({ id: 's1', kind: 'shape', stroke: 'ink', strokeStyle: 'dashed' }),
    );
    expect(s?.dash).toBe('8 6');
  });
});

describe('textInk', () => {
  it('uses textColor when set, but Claude stays sky', () => {
    expect(textInk(box({ id: 't1', textColor: 'rose' }))).toBe(FILLS.rose.ink);
    expect(textInk(box({ id: 'c1', by: 'claude', textColor: 'rose' }))).toBe(
      FILLS.sky.ink,
    );
  });
});
