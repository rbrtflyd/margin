import { describe, expect, it } from 'vitest';
import {
  SNAP,
  alongPath,
  boxesForAsk,
  connectorEdges,
  connectorPoints,
  detachAnchor,
  elbowMid,
  elbowPoints,
  nearestT,
  oppositeSide,
  pathD,
  pathDGapped,
  QUICK_GAP,
  quickCreateOrigin,
  resolveEnds,
  snapAnchor,
  STUB,
} from './connectors';
import type { Item } from './types';
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

  it('stores auto instead of a side when asAuto is set', () => {
    expect(snapAnchor({ x: 110, y: 40 }, rects(box), SNAP, undefined, true)).toEqual({
      itemId: 'n1',
      side: 'auto',
    });
  });
});

describe('resolveEnds', () => {
  it('picks auto from the other endpoint, not 0,0', () => {
    const a = { x: 0, y: 0, w: 100, h: 80 };
    const b = { x: 200, y: 0, w: 100, h: 80 };
    const m = new Map([
      ['a', a],
      ['b', b],
    ]);
    const ends = resolveEnds(
      { itemId: 'a', side: 'auto' },
      { itemId: 'b', side: 'auto' },
      m,
      { x: 0, y: 0 },
    );
    expect(ends.start.side).toBe('e');
    expect(ends.end.side).toBe('w');
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

  it('offsets the mid segment by bend', () => {
    const pts = elbowPoints({ x: 0, y: 0 }, 'e', { x: 100, y: 40 }, 'w', 12);
    const mid = elbowMid(pts);
    expect(mid?.axis).toBe('x');
    expect(mid?.a.x).toBe((STUB + (100 - STUB)) / 2 + 12);
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

  it('samples a curved route with more than two points', () => {
    const pts = connectorPoints(
      { p: { x: 0, y: 0 }, side: 'e' },
      { p: { x: 100, y: 40 }, side: 'w' },
      'curved',
    );
    expect(pts.length).toBeGreaterThan(2);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 40 });
  });
});

describe('alongPath', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];

  it('returns endpoints and the midpoint', () => {
    expect(alongPath(line, 0)).toEqual({ x: 0, y: 0 });
    expect(alongPath(line, 0.5)).toEqual({ x: 50, y: 0 });
    expect(alongPath(line, 1)).toEqual({ x: 100, y: 0 });
  });
});

describe('nearestT', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];

  it('maps a point on the path to t', () => {
    expect(nearestT(line, { x: 0, y: 0 })).toBe(0);
    expect(nearestT(line, { x: 75, y: 8 })).toBeCloseTo(0.75);
    expect(nearestT(line, { x: 100, y: 0 })).toBe(1);
  });
});

describe('pathDGapped', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];

  it('matches pathD when there is no gap', () => {
    expect(pathDGapped(line, null)).toBe(pathD(line));
  });

  it('splits the stroke around a label box', () => {
    const d = pathDGapped(line, { x: 40, y: -8, w: 20, h: 16 });
    expect(d.startsWith('M')).toBe(true);
    expect(d.includes(' M')).toBe(true);
    expect(d).not.toBe(pathD(line));
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

describe('connectorEdges', () => {
  const sticky = (id: string, text: string): Item => ({
    id,
    x: 0,
    y: 0,
    text,
    by: 'me',
    createdAt: '',
    editedAt: '',
    kind: 'sticky',
  });

  it('omits connectors from boxes and lists them as edges', () => {
    const items: Item[] = [
      sticky('a', 'Intake'),
      sticky('b', 'Review'),
      {
        id: 'c1',
        x: 0,
        y: 0,
        text: 'depends',
        by: 'me',
        createdAt: '',
        editedAt: '',
        kind: 'connector',
        start: { itemId: 'a', side: 'e' },
        end: { x: 10, y: 10 },
      },
    ];
    expect(boxesForAsk(items).map((i) => i.id)).toEqual(['a', 'b']);
    expect(connectorEdges(items)).toEqual([
      { from: 'a', to: null, label: 'depends' },
    ]);
  });
});
