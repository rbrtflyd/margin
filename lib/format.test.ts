import { describe, expect, it } from 'vitest';
import { wrapSelection } from './format';

describe('wrapSelection', () => {
  it('wraps a range in bold markers', () => {
    expect(wrapSelection('hello world', 0, 5, 'bold')).toEqual({
      text: '**hello** world',
      start: 2,
      end: 7,
    });
  });

  it('unwraps bold when the range is already marked', () => {
    expect(wrapSelection('**hello** world', 2, 7, 'bold')).toEqual({
      text: 'hello world',
      start: 0,
      end: 5,
    });
  });

  it('wraps italic and strike', () => {
    expect(wrapSelection('ab', 0, 2, 'italic').text).toBe('*ab*');
    expect(wrapSelection('ab', 0, 2, 'strike').text).toBe('~ab~');
  });

  it('wraps a link around the selection', () => {
    expect(wrapSelection('docs', 0, 4, 'link', 'https://ex.com')).toEqual({
      text: '[docs](https://ex.com)',
      start: 1,
      end: 5,
    });
  });

  it('inserts a placeholder when the caret has no range', () => {
    expect(wrapSelection('ab', 1, 1, 'bold').text).toBe('a**bold**b');
  });
});
