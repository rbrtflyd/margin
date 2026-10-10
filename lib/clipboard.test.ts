import { describe, expect, it } from 'vitest';
import { isAttach } from './connectors';
import { cloneItems, decodeItems, encodeItems, shiftItem } from './clipboard';
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

describe('cloneItems', () => {
  it('assigns new ids and keeps text', () => {
    const a = item({ id: 't_a', x: 10, y: 20, text: 'hello', w: 80 });
    const [copy] = cloneItems([a], [a]);
    expect(copy.id).not.toBe('t_a');
    expect(copy.text).toBe('hello');
    expect(copy.x).toBe(10);
    expect(copy.y).toBe(20);
  });

  it('reattaches connectors whose both ends were copied', () => {
    const a = item({ id: 'n_a', kind: 'shape', shape: 'rect', w: 40, h: 40 });
    const b = item({
      id: 'n_b',
      kind: 'shape',
      shape: 'rect',
      x: 100,
      w: 40,
      h: 40,
    });
    const c = item({
      id: 'c_ab',
      kind: 'connector',
      start: { itemId: 'n_a', side: 'e' },
      end: { itemId: 'n_b', side: 'w' },
    });
    const copies = cloneItems([a, b, c], [a, b, c]);
    const ca = copies.find((i) => i.text === a.text && i.kind === 'shape');
    const cb = copies.find((i) => i.id !== ca?.id && i.kind === 'shape');
    const line = copies.find((i) => i.kind === 'connector');
    expect(line?.start).toEqual({ itemId: ca?.id, side: 'e' });
    expect(line?.end).toEqual({ itemId: cb?.id, side: 'w' });
  });

  it('turns an end attached to an uncopied node into a free point', () => {
    const a = item({ id: 'n_a', kind: 'shape', shape: 'rect', w: 100, h: 80 });
    const b = item({
      id: 'n_b',
      kind: 'shape',
      shape: 'rect',
      x: 200,
      w: 40,
      h: 40,
    });
    const c = item({
      id: 'c_ab',
      kind: 'connector',
      start: { itemId: 'n_a', side: 'e' },
      end: { x: 50, y: 50 },
    });
    const copies = cloneItems([c], [a, b, c]);
    const line = copies[0];
    expect(isAttach(line.start!)).toBe(false);
    expect(line.start).toEqual({ x: 100, y: 40 });
    expect(line.end).toEqual({ x: 50, y: 50 });
  });

  it('gives a new groupId when the whole group is copied', () => {
    const a = item({ id: 'a', groupId: 'g1', x: 0 });
    const b = item({ id: 'b', groupId: 'g1', x: 10 });
    const copies = cloneItems([a, b], [a, b]);
    expect(copies[0].groupId).toBeTruthy();
    expect(copies[0].groupId).not.toBe('g1');
    expect(copies[0].groupId).toBe(copies[1].groupId);
  });

  it('drops groupId when only part of a group is copied', () => {
    const a = item({ id: 'a', groupId: 'g1', x: 0 });
    const b = item({ id: 'b', groupId: 'g1', x: 10 });
    const copies = cloneItems([a], [a, b]);
    expect(copies[0].groupId).toBeUndefined();
  });
});

describe('shiftItem', () => {
  it('moves a box', () => {
    expect(shiftItem(item({ id: 'a', x: 10, y: 20 }), 3, 4)).toMatchObject({
      x: 13,
      y: 24,
    });
  });

  it('moves a connector free end and leaves attached ends', () => {
    const c = item({
      id: 'c',
      kind: 'connector',
      start: { itemId: 'n', side: 'e' },
      end: { x: 8, y: 9 },
    });
    const next = shiftItem(c, 10, 2);
    expect(next.start).toEqual({ itemId: 'n', side: 'e' });
    expect(next.end).toEqual({ x: 18, y: 11 });
  });
});

describe('encodeItems', () => {
  it('round-trips through decodeItems', () => {
    const a = item({ id: 't_a', text: 'x' });
    expect(decodeItems(encodeItems([a]))?.[0].text).toBe('x');
  });
});
