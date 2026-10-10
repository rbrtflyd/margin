import { describe, expect, it } from 'vitest';
import { expandGroups, restack, unlockedIds } from './stack';
import type { Item } from './types';

function item(partial: Partial<Item> & Pick<Item, 'id'>): Item {
  return {
    x: 0,
    y: 0,
    text: '',
    by: 'me',
    createdAt: '2020-01-01T00:00:00.000Z',
    editedAt: '2020-01-01T00:00:00.000Z',
    ...partial,
  };
}

const a = item({ id: 'a', kind: 'shape', shape: 'rect' });
const b = item({ id: 'b', kind: 'shape', shape: 'rect' });
const c = item({ id: 'c', kind: 'shape', shape: 'rect' });
const l1 = item({ id: 'l1', kind: 'connector' });
const l2 = item({ id: 'l2', kind: 'connector' });

describe('restack', () => {
  it('moves a node one step forward among nodes', () => {
    const next = restack([a, l1, b, l2, c], ['a'], 'forward');
    expect(next.map((i) => i.id)).toEqual(['b', 'l1', 'a', 'l2', 'c']);
  });

  it('moves a node to the front of the node layer', () => {
    const next = restack([a, l1, b, c], ['a'], 'front');
    expect(next.map((i) => i.id)).toEqual(['b', 'l1', 'c', 'a']);
  });

  it('moves a connector backmost among connectors', () => {
    const next = restack([a, l1, b, l2], ['l2'], 'backmost');
    expect(next.map((i) => i.id)).toEqual(['a', 'l2', 'b', 'l1']);
  });

  it('moves a node one step back among nodes', () => {
    const next = restack([a, b, c], ['c'], 'back');
    expect(next.map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('expandGroups', () => {
  it('adds every member of a touched group', () => {
    const g1 = item({ id: 'a', groupId: 'g' });
    const g2 = item({ id: 'b', groupId: 'g' });
    const lone = item({ id: 'c' });
    expect([...expandGroups([g1, g2, lone], ['a'])].sort()).toEqual(['a', 'b']);
  });
});

describe('unlockedIds', () => {
  it('drops locked members', () => {
    expect(
      unlockedIds(
        [item({ id: 'a', locked: true }), item({ id: 'b' })],
        ['a', 'b'],
      ),
    ).toEqual(['b']);
  });
});
