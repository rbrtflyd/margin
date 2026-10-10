import { describe, expect, it } from 'vitest';
import { exportJSON, parseImport } from './store';
import type { Board } from './types';

const v1File = JSON.stringify({
  app: 'margin',
  version: 1,
  board: {
    name: 'Old board',
    items: [
      {
        id: 't_old',
        x: 12,
        y: 34,
        text: 'hello',
        by: 'me',
        createdAt: '2020-01-01T00:00:00.000Z',
        editedAt: '2020-01-01T00:00:00.000Z',
      },
      {
        id: 'c_old',
        x: 0,
        y: 0,
        text: '',
        by: 'me',
        createdAt: '2020-01-01T00:00:00.000Z',
        editedAt: '2020-01-01T00:00:00.000Z',
        kind: 'connector',
        route: 'straight',
        start: { x: 0, y: 0 },
        end: { itemId: 't_old', side: 'e' },
      },
    ],
  },
});

describe('parseImport', () => {
  it('loads a file that omits v2 fields', () => {
    const board = parseImport(v1File);
    expect(typeof board).not.toBe('string');
    if (typeof board === 'string') return;
    expect(board.name).toBe('Old board');
    expect(board.items).toHaveLength(2);
    const text = board.items.find((i) => i.id === 't_old');
    expect(text?.text).toBe('hello');
    expect(text?.stroke).toBeUndefined();
    expect(text?.locked).toBeUndefined();
    expect(text?.fontSize).toBeUndefined();
    const line = board.items.find((i) => i.id === 'c_old');
    expect(line?.route).toBe('straight');
    expect(line?.arrowEnd).toBeUndefined();
    expect(line?.start).toEqual({ x: 0, y: 0 });
    expect(line?.end).toEqual({ itemId: 't_old', side: 'e' });
  });
});

describe('exportJSON', () => {
  it('writes version 2', () => {
    const board: Board = {
      id: 'b1',
      name: 'N',
      items: [],
      view: null,
      asks: [],
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    };
    expect(JSON.parse(exportJSON(board)).version).toBe(2);
  });
});
