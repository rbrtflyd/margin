import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT, boardContext, validateAsk } from './assistant';

describe('validateAsk', () => {
  it('keeps boxes and parses edges, including free ends', () => {
    const got = validateAsk({
      question: 'what connects to what?',
      boardName: 'Board',
      items: [
        { id: 'a', text: 'Alpha', x: 0, y: 0, by: 'me' },
        { id: 'b', text: 'Beta', x: 10, y: 0, by: 'me' },
      ],
      edges: [
        { from: 'a', to: 'b', label: 'depends' },
        { from: null, to: 'b', label: '' },
      ],
      selectedIds: ['a'],
    });
    expect(typeof got).toBe('object');
    if (typeof got === 'string') throw new Error(got);
    expect(got.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(got.edges).toEqual([
      { from: 'a', to: 'b', label: 'depends' },
      { from: null, to: 'b', label: '' },
    ]);
  });

  it('defaults missing edges to an empty list', () => {
    const got = validateAsk({ question: 'hello', items: [] });
    expect(typeof got).toBe('object');
    if (typeof got === 'string') throw new Error(got);
    expect(got.edges).toEqual([]);
  });
});

describe('boardContext', () => {
  it('lists boxes then connections, using (free) for a null end', () => {
    const ctx = boardContext({
      question: 'what connects to what?',
      boardName: 'Board',
      items: [
        { id: 'a', text: 'Alpha sticky', x: 0, y: 10, by: 'me' },
        { id: 'b', text: 'Beta sticky', x: 80, y: 10, by: 'me' },
      ],
      edges: [
        { from: 'a', to: 'b', label: 'depends' },
        { from: 'b', to: null, label: '' },
      ],
      selectedIds: [],
      history: [],
    });
    expect(ctx).toContain('[a]');
    expect(ctx).toContain('Alpha sticky');
    expect(ctx).toContain('Connections:');
    expect(ctx).toContain('[a] --depends--> [b]');
    expect(ctx).toContain('[b] --> (free)');
    expect(ctx).not.toContain('connector');
  });
});

describe('SYSTEM_PROMPT', () => {
  it('mentions connections without changing the rubber-duck stance', () => {
    expect(SYSTEM_PROMPT).toMatch(/connections/i);
    expect(SYSTEM_PROMPT).toMatch(/rubber duck/i);
    expect(SYSTEM_PROMPT).not.toMatch(/generate/i);
    expect(SYSTEM_PROMPT).not.toMatch(/suggest/i);
  });
});
