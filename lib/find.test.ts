import { describe, expect, it } from 'vitest';
import { findMatches, itemSearchText } from './find';
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

describe('itemSearchText', () => {
  it('joins text, caption, link title, description, and url', () => {
    const it = item({
      id: 'a',
      text: 'body',
      caption: 'photo',
      url: 'https://example.com',
      meta: { title: 'Example', description: 'A site' },
    });
    expect(itemSearchText(it)).toBe('body photo Example A site https://example.com');
  });
});

describe('findMatches', () => {
  it('matches case-insensitively', () => {
    const a = item({ id: 'a', text: 'Research notes' });
    expect(findMatches([a], 'research')).toEqual(['a']);
  });

  it('matches a caption and a link title', () => {
    const cap = item({ id: 'c', kind: 'image', caption: 'harbor photo' });
    const link = item({
      id: 'l',
      kind: 'link',
      meta: { title: 'Harbor map' },
    });
    const miss = item({ id: 'm', text: 'unrelated' });
    expect(findMatches([cap, link, miss], 'harbor')).toEqual(['c', 'l']);
  });

  it('matches a connector label', () => {
    const line = item({ id: 'ln', kind: 'connector', text: 'depends on' });
    expect(findMatches([line], 'depends')).toEqual(['ln']);
  });

  it('matches a section name', () => {
    const sec = item({ id: 's', kind: 'section', text: 'Research' });
    expect(findMatches([sec], 'research')).toEqual(['s']);
  });

  it('returns nothing for an empty query', () => {
    const a = item({ id: 'a', text: 'hello' });
    expect(findMatches([a], '   ')).toEqual([]);
  });

  it('sorts matches by y then x', () => {
    const a = item({ id: 'a', text: 'hit', x: 20, y: 10 });
    const b = item({ id: 'b', text: 'hit', x: 0, y: 10 });
    const c = item({ id: 'c', text: 'hit', x: 0, y: 0 });
    expect(findMatches([a, b, c], 'hit')).toEqual(['c', 'b', 'a']);
  });
});
