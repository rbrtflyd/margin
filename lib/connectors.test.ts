import { describe, expect, it } from 'vitest';
import {
  SNAP,
  connectorPoints,
  detachAnchor,
  elbowPoints,
  oppositeSide,
  QUICK_GAP,
  quickCreateOrigin,
  snapAnchor,
  STUB,
} from './connectors';
import type { Rect } from './items';

function rects(r: Rect, id = 'n1') {
  return new Map([[id, r]]);
}

const box: Rect = { x: 0, y: 0, w: 100, h: 80 };

describe('snapAnchor', () => {
  it('attaches to the nearest side inside the default SNAP distance', () => {
    expect(snapAnchor({ x: 110, y: 40 }, rects(box))).toEqual({
      itemId: 'n1',
      side: 'e',
    });
  });

  it('stays a free point outside SNAP', () => {
    expect(snapAnchor({ x: 200, y: 40 }, rects(box))).toEqual({ x: 200, y: 40 });
  });

  it('skips an excluded item', () => {
    expect(snapAnchor({ x: 110, y: 40 }, rects(box), SNAP, 'n1')).toEqual({
      x: 110,
      y: 40,
    });
  });

  it('uses SNAP / k so the grab distance stays ~28px on screen', () => {
    const justOutside = { x: 100 + 20, y: 40 };
    expect(snapAnchor(justOutside, rects(box), SNAP / 1)).toEqual({
      itemId: 'n1',
      side: 'e',
    });
    expect(snapAnchor(justOutside, rects(box), SNAP / 4)).toEqual({
      x: 120,
      y: 40,
    });
    expect(snapAnchor(justOutside, rects(box), SNAP / 0.25)).toEqual({
      itemId: 'n1',
      side: 'e',
    });
  });
});

describe('elbowPoints', () => {
  it('routes east-west with a vertical mid segment', () => {
    const pts = elbowPoints({ x: 0, y: 0 }, 'e', { x: 100, y: 40 }, 'w');
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: STUB, y: 0 });
    expect(pts[pts.length - 2]).toEqual({ x: 100 - STUB, y: 40 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 40 });
    const midX = (STUB + (100 - STUB)) / 2;
    expect(pts.some((p) => p.x === midX && p.y === 0)).toBe(true);
    expect(pts.some((p) => p.x === midX && p.y === 40)).toBe(true);
  });
});

describe('connectorPoints', () => {
  it('returns the two endpoints for a straight route', () => {
    expect(
      connectorPoints(
        { p: { x: 1, y: 2 }, side: null },
        { p: { x: 3, y: 4 }, side: null },
        'straight',
      ),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it('uses elbowPoints for an elbow route', () => {
    const start = { p: { x: 0, y: 0 }, side: 'e' as const };
    const end = { p: { x: 100, y: 40 }, side: 'w' as const };
    expect(connectorPoints(start, end, 'elbow')).toEqual(
      elbowPoints(start.p, start.side, end.p, end.side),
    );
  });
});

describe('quickCreateOrigin', () => {
  it('places a sibling beyond the given side, centered', () => {
    const from = { x: 0, y: 0, w: 100, h: 80 };
    const size = { w: 100, h: 80 };
    expect(quickCreateOrigin(from, 'e', size)).toEqual({
      x: 100 + QUICK_GAP,
      y: 0,
    });
    expect(quickCreateOrigin(from, 'w', size)).toEqual({
      x: -QUICK_GAP - 100,
      y: 0,
    });
    expect(quickCreateOrigin(from, 's', size)).toEqual({
      x: 0,
      y: 80 + QUICK_GAP,
    });
    expect(quickCreateOrigin(from, 'n', size)).toEqual({
      x: 0,
      y: -QUICK_GAP - 80,
    });
  });

  it('maps each side to its opposite', () => {
    expect(oppositeSide('e')).toBe('w');
    expect(oppositeSide('w')).toBe('e');
    expect(oppositeSide('n')).toBe('s');
    expect(oppositeSide('s')).toBe('n');
  });
});

describe('detachAnchor', () => {
  it('turns an attached end into a free point when its node is gone', () => {
    const gone = new Set(['n1']);
    expect(
      detachAnchor({ itemId: 'n1', side: 'e' }, gone, rects(box)),
    ).toEqual({ x: 100, y: 40 });
  });

  it('leaves an attached end alone when its node remains', () => {
    const a = { itemId: 'n1', side: 'e' as const };
    expect(detachAnchor(a, new Set(['other']), rects(box))).toEqual(a);
  });
});
