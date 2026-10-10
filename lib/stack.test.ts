import { describe, expect, it } from 'vitest';
import { expandContained, expandGroups, restack, unlockedIds } from './stack';
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

  it('never lifts a section into the node layer', () => {
    const n1 = item({ id: 'n1', kind: 'section' });
    const n2 = item({ id: 'n2', kind: 'section' });
    const next = restack([n1, a, n2, l1], ['n1'], 'front');
    expect(next.map((i) => i.id)).toEqual(['n2', 'a', 'n1', 'l1']);
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

describe('expandContained', () => {
  it('adds items whose centers sit inside a selected section', () => {
    const sec = item({
      id: 'n1',
      kind: 'section',
      x: 0,
      y: 0,
      w: 400,
      h: 300,
    });
    const inside = item({ id: 'a', kind: 'sticky', x: 40, y: 40, w: 160, h: 160 });
    const outside = item({ id: 'b', kind: 'sticky', x: 500, y: 40, w: 160, h: 160 });
    const nested = item({
      id: 'n2',
      kind: 'section',
      x: 20,
      y: 20,
      w: 200,
      h: 200,
    });
    const line = item({ id: 'l1', kind: 'connector', x: 50, y: 50 });
    expect(
      [...expandContained([sec, inside, outside, nested, line], ['n1'])].sort(),
    ).toEqual(['a', 'n1', 'n2']);
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
