import { describe, expect, it } from 'vitest';
import { embedSrc } from './embeds';

describe('embedSrc', () => {
  it('rewrites a YouTube watch URL to youtube-nocookie embed', () => {
    expect(embedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(embedSrc('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
  });

  it('leaves a non-allowlisted URL as a link card', () => {
    expect(embedSrc('https://github.com/facebook/react')).toBeNull();
    expect(embedSrc('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('rewrites Vimeo, Figma, and Spotify', () => {
    expect(embedSrc('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
    expect(embedSrc('https://www.figma.com/design/abc123/File')).toBe(
      'https://embed.figma.com/design/abc123/File?embed-host=share',
    );
    expect(embedSrc('https://open.spotify.com/track/abc')).toBe(
      'https://open.spotify.com/embed/track/abc',
    );
  });
});
