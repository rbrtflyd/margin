import { describe, expect, it } from 'vitest';
import {
  ASSET_TTL_MS,
  fitWithin,
  isGcCandidate,
  referencedAssetIds,
} from './images';

describe('fitWithin', () => {
  it('leaves a smaller image alone', () => {
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });

  it('scales the long side to 2048', () => {
    expect(fitWithin(4096, 2048)).toEqual({ w: 2048, h: 1024 });
    expect(fitWithin(1024, 4096)).toEqual({ w: 512, h: 2048 });
  });

  it('rejects non-positive sizes', () => {
    expect(fitWithin(0, 10)).toEqual({ w: 1, h: 1 });
  });
});

describe('referencedAssetIds', () => {
  it('collects asset ids from items', () => {
    expect(
      referencedAssetIds([
        { assetId: 'a' },
        {},
        { assetId: 'a' },
        { assetId: 'b' },
      ]),
    ).toEqual(new Set(['a', 'b']));
  });
});

describe('isGcCandidate', () => {
  const now = Date.parse('2026-10-10T00:00:00.000Z');

  it('keeps files still referenced by a board', () => {
    expect(
      isGcCandidate(
        'kg1',
        '2020-01-01T00:00:00.000Z',
        new Set(['kg1']),
        now,
      ),
    ).toBe(false);
  });

  it('keeps unreferenced files younger than 30 days', () => {
    expect(
      isGcCandidate(
        'kg1',
        new Date(now - ASSET_TTL_MS + 60_000).toISOString(),
        new Set(),
        now,
      ),
    ).toBe(false);
  });

  it('deletes unreferenced files older than 30 days', () => {
    expect(
      isGcCandidate(
        'kg1',
        new Date(now - ASSET_TTL_MS - 60_000).toISOString(),
        new Set(),
        now,
      ),
    ).toBe(true);
  });
});
