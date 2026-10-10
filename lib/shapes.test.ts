import { describe, expect, it } from 'vitest';
import { SHAPE_KINDS, shapePad, shapePaths } from './shapes';

describe('shapePaths', () => {
  it('returns a non-empty path for every shape kind', () => {
    for (const kind of SHAPE_KINDS) {
      const paths = shapePaths(kind, 140, 140);
      expect(paths.length, kind).toBeGreaterThan(0);
      for (const p of paths) {
        expect(p.d.length, kind).toBeGreaterThan(4);
        expect(p.d, kind).toMatch(/^M /);
      }
    }
  });

  it('treats a missing kind as a rectangle', () => {
    expect(shapePaths(undefined, 10, 10)).toEqual(shapePaths('rect', 10, 10));
  });

  it('cylinder has a body plus a top ellipse', () => {
    expect(shapePaths('cylinder', 100, 80)).toHaveLength(2);
  });

  it('pads triangle and speech so text sits inside the path', () => {
    expect(shapePad('triangle')).toContain('%');
    expect(shapePad('speech')).toContain('%');
  });
});
