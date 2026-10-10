import { describe, expect, it } from 'vitest';
import { intersects, pointsBounds, worldViewport } from './viewport';

describe('worldViewport', () => {
  it('expands the visible world rect by margin over zoom', () => {
    const v = worldViewport({ x: 0, y: 0, k: 1 }, 800, 600, 256);
    expect(v).toEqual({ x: -256, y: -256, w: 800 + 512, h: 600 + 512 });
    const zoomedOut = worldViewport({ x: 0, y: 0, k: 0.5 }, 800, 600, 256);
    expect(zoomedOut.x).toBe(-512);
    expect(zoomedOut.w).toBe(800 / 0.5 + 1024);
  });
});

describe('intersects', () => {
  it('returns false for disjoint rects', () => {
    expect(
      intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }),
    ).toBe(false);
  });

  it('returns true when a segment crosses the view', () => {
    const view = { x: 0, y: 0, w: 100, h: 100 };
    const line = pointsBounds(
      [
        { x: -50, y: 50 },
        { x: 150, y: 50 },
      ],
      0,
    );
    expect(intersects(view, line)).toBe(true);
  });
});

describe('pointsBounds', () => {
  it('pads endpoints so a bent elbow still counts', () => {
    const tight = pointsBounds(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      0,
    );
    const padded = pointsBounds(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      40,
    );
    expect(padded.y).toBe(tight.y - 40);
    expect(padded.h).toBe(tight.h + 80);
    expect(padded.w).toBe(tight.w + 80);
  });
});
