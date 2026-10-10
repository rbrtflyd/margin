import { describe, expect, it } from 'vitest';
import { seedItems } from './seed';

describe('seedItems', () => {
  it('returns 2000 items including a section', () => {
    const items = seedItems(2000, { x: 0, y: 0 });
    expect(items).toHaveLength(2000);
    expect(items.some((it) => it.kind === 'section')).toBe(true);
  });
});
