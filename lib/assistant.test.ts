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

  it('keeps captions, titles, and urls on boxes', () => {
    const got = validateAsk({
      question: "what's on the board?",
      items: [
        {
          id: 'i1',
          text: '',
          x: 0,
          y: 0,
          by: 'me',
          caption: 'sky card',
        },
        {
          id: 'l1',
          text: '',
          x: 10,
          y: 0,
          by: 'me',
          url: 'https://github.com/foo/bar',
          title: 'foo/bar',
          description: 'a repo',
        },
      ],
    });
    expect(typeof got).toBe('object');
    if (typeof got === 'string') throw new Error(got);
    expect(got.items[0].caption).toBe('sky card');
    expect(got.items[1]).toMatchObject({
      url: 'https://github.com/foo/bar',
      title: 'foo/bar',
      description: 'a repo',
    });
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

  it('lists captions, titles, and urls under a box', () => {
    const ctx = boardContext({
      question: "what's on the board?",
      boardName: 'Board',
      items: [
        {
          id: 'i1',
          text: '',
          x: 0,
          y: 0,
          by: 'me',
          caption: 'sky card',
        },
        {
          id: 'l1',
          text: '',
          x: 40,
          y: 0,
          by: 'me',
          url: 'https://github.com/foo/bar',
          title: 'foo/bar',
        },
      ],
      edges: [],
      selectedIds: [],
      history: [],
    });
    expect(ctx).toContain('caption: sky card');
    expect(ctx).toContain('title: foo/bar');
    expect(ctx).toContain('url: https://github.com/foo/bar');
    expect(ctx).not.toMatch(/\[i1\][^\n]*\n\(empty\)/);
  });

  it('labels a section by name', () => {
    const ctx = boardContext({
      question: "what's on the board?",
      boardName: 'Board',
      items: [
        {
          id: 'n1',
          text: 'Research',
          x: 0,
          y: 0,
          by: 'me',
          kind: 'section',
        },
      ],
      edges: [],
      selectedIds: [],
      history: [],
    });
    expect(ctx).toContain('section: Research');
  });
});

describe('SYSTEM_PROMPT', () => {
  it('mentions connections without changing the rubber-duck stance', () => {
    expect(SYSTEM_PROMPT).toMatch(/connections/i);
    expect(SYSTEM_PROMPT).toMatch(/rubber duck/i);
    expect(SYSTEM_PROMPT).not.toMatch(/generate/i);
    expect(SYSTEM_PROMPT).not.toMatch(/suggest/i);
  });

  it('tells the assistant to read captions and urls, not pixels', () => {
    expect(SYSTEM_PROMPT).toMatch(/captions/i);
    expect(SYSTEM_PROMPT).toMatch(/pixels/i);
    expect(SYSTEM_PROMPT).toMatch(/link cards/i);
    expect(SYSTEM_PROMPT).toMatch(/sections/i);
  });
});
