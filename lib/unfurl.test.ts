import { describe, expect, it } from 'vitest';
import { isLoneUrl } from './links';
import {
  assertSafeUrl,
  isBlockedAddress,
  parseMeta,
  unfurl,
  UnfurlError,
} from './unfurl';

describe('isLoneUrl', () => {
  it('accepts a single http(s) URL', () => {
    expect(isLoneUrl('https://github.com/foo/bar')).toBe(
      'https://github.com/foo/bar',
    );
    expect(isLoneUrl('  http://example.com  ')).toBe('http://example.com/');
  });

  it('rejects text that is not a lone URL', () => {
    expect(isLoneUrl('see https://example.com')).toBeNull();
    expect(isLoneUrl('https://a.com\nhttps://b.com')).toBeNull();
    expect(isLoneUrl('ftp://example.com')).toBeNull();
  });
});

describe('isBlockedAddress', () => {
  it('blocks loopback, private, and link-local IPv4', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('10.0.0.1')).toBe(true);
    expect(isBlockedAddress('192.168.1.1')).toBe(true);
    expect(isBlockedAddress('169.254.1.1')).toBe(true);
    expect(isBlockedAddress('172.16.0.1')).toBe(true);
  });

  it('allows a public IPv4 address', () => {
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  it('rejects loopback literals', async () => {
    await expect(assertSafeUrl('http://127.0.0.1/secret')).rejects.toBeInstanceOf(
      UnfurlError,
    );
  });

  it('rejects localhost', async () => {
    await expect(assertSafeUrl('http://localhost/x')).rejects.toBeInstanceOf(
      UnfurlError,
    );
  });

  it('rejects a public hostname that resolves to loopback', async () => {
    await expect(
      assertSafeUrl('http://evil.example/', async () => [
        { address: '127.0.0.1', family: 4 },
      ]),
    ).rejects.toBeInstanceOf(UnfurlError);
  });
});

describe('parseMeta', () => {
  it('reads Open Graph tags from a public page shape', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="margin" />
        <meta property="og:description" content="a board" />
        <meta property="og:site_name" content="GitHub" />
        <meta property="og:image" content="/img.png" />
        <title>ignored</title>
      </head></html>`;
    expect(parseMeta(html, 'https://github.com/foo/bar')).toEqual({
      title: 'margin',
      description: 'a board',
      siteName: 'GitHub',
      thumb: 'https://github.com/img.png',
      provider: 'github.com',
    });
  });
});

describe('unfurl', () => {
  const publicLookup = async () => [{ address: '1.2.3.4', family: 4 }];

  it('returns parsed meta for a public URL', async () => {
    const meta = await unfurl('https://example.com/page', {
      lookup: publicLookup,
      fetch: async () =>
        new Response(
          '<html><head><meta property="og:title" content="Hello"></head></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        ),
    });
    expect(meta.title).toBe('Hello');
    expect(meta.provider).toBe('example.com');
  });

  it('rejects a redirect to a private address', async () => {
    await expect(
      unfurl('https://example.com/go', {
        lookup: publicLookup,
        fetch: async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://127.0.0.1/admin' },
          }),
      }),
    ).rejects.toBeInstanceOf(UnfurlError);
  });
});
