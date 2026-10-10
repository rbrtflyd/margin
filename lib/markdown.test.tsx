import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './markdown';

describe('Markdown', () => {
  it('renders a markdown link as an anchor that opens in a new tab', () => {
    const html = renderToStaticMarkup(
      <Markdown text="see [docs](https://ex.com)" />,
    );
    expect(html).toContain('href="https://ex.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('docs');
  });
});
