import { afterEach, describe, expect, it } from 'vitest';
import {
  applyResize,
  boundsOf,
  FILLS,
  fontPx,
  forgetSize,
  isBox,
  isSection,
  hasRect,
  SECTION_W,
  SECTION_H,
  storedRect,
  mapBox,
  paintOf,
  rememberSize,
  scaleItem,
  STICKY_SIZE,
  STICKY_WIDE,
  strokeOf,
  textAlign,
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

  it('keeps the aspect ratio on an edge handle', () => {
    expect(applyResize(start, 'e', 20, 0, true)).toEqual({
      x: 0,
      y: -8,
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

describe('isBox', () => {
  it('includes images, link cards, and embeds', () => {
    expect(isBox(box({ id: 'i1', kind: 'image' }))).toBe(true);
    expect(isBox(box({ id: 'l1', kind: 'link' }))).toBe(true);
    expect(isBox(box({ id: 'e1', kind: 'embed' }))).toBe(true);
    expect(isBox(box({ id: 'c1', kind: 'connector' }))).toBe(false);
    expect(isBox(box({ id: 'n1', kind: 'section' }))).toBe(false);
  });
});

describe('isSection / hasRect', () => {
  it('treats sections as rects, not boxes', () => {
    const sec = box({ id: 'n1', kind: 'section' });
    expect(isSection(sec)).toBe(true);
    expect(hasRect(sec)).toBe(true);
    expect(hasRect(box({ id: 'c1', kind: 'connector' }))).toBe(false);
    expect(storedRect(sec)).toEqual({
      x: 10,
      y: 20,
      w: SECTION_W,
      h: SECTION_H,
    });
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

describe('font and align', () => {
  it('maps fontSize tokens to pixels and defaults to m', () => {
    expect(fontPx(box({ id: 't1' }))).toBe(14);
    expect(fontPx(box({ id: 't1', fontSize: 'xl' }))).toBe(24);
  });

  it('centers shapes and left-aligns text by default', () => {
    expect(textAlign(box({ id: 't1' }))).toBe('left');
    expect(textAlign(box({ id: 's1', kind: 'shape' }))).toBe('center');
    expect(textAlign(box({ id: 's1', kind: 'shape', align: 'left' }))).toBe(
      'left',
    );
  });

  it('defines a wide sticky preset', () => {
    expect(STICKY_WIDE).toBe(320);
  });
});
