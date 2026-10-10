import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';
import type { LinkMeta } from './types';
export { isLoneUrl } from './links';

export const UNFURL_TIMEOUT_MS = 5000;
export const UNFURL_MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 5;

export type DnsAnswer = { address: string; family: number };
export type LookupFn = (host: string) => Promise<DnsAnswer[]>;
export type FetchFn = typeof fetch;

export class UnfurlError extends Error {
  constructor(message = 'Could not unfurl') {
    super(message);
    this.name = 'UnfurlError';
  }
}

export function isBlockedAddress(address: string): boolean {
  const mapped = address.toLowerCase().startsWith('::ffff:')
    ? address.slice(7)
    : address;
  const v = net.isIP(mapped);
  if (v === 4) {
    const p = mapped.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
      return true;
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (v === 6) {
    const n = mapped.toLowerCase();
    if (n === '::1' || n === '::') return true;
    if (n.startsWith('fe8') || n.startsWith('fe9') || n.startsWith('fea') || n.startsWith('feb'))
      return true;
    if (n.startsWith('fc') || n.startsWith('fd')) return true;
    if (n.startsWith('ff')) return true;
    return false;
  }
  return true;
}

function isBlockedHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    h === 'localhost' ||
    h === 'localhost.localdomain' ||
    h === 'ip6-localhost' ||
    h === 'metadata.google.internal'
  )
    return true;
  if (h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (net.isIP(h) && isBlockedAddress(h)) return true;
  return false;
}

async function defaultLookup(host: string): Promise<DnsAnswer[]> {
  const rows = await dnsLookup(host, { all: true });
  return rows.map((r) => ({ address: r.address, family: r.family }));
}

export async function assertSafeUrl(
  raw: string,
  lookup: LookupFn = defaultLookup,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnfurlError();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnfurlError();
  if (url.username || url.password) throw new UnfurlError();
  if (isBlockedHost(url.hostname)) throw new UnfurlError();
  const answers = await lookup(url.hostname.replace(/^\[|\]$/g, ''));
  if (!answers.length || answers.some((a) => isBlockedAddress(a.address))) {
    throw new UnfurlError();
  }
  return url;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function metaContent(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<meta\\s+[^>]*?(?:property|name)\\s*=\\s*["']${esc}["'][^>]*?content\\s*=\\s*["']([^"']*)["'][^>]*>|<meta\\s+[^>]*?content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${esc}["'][^>]*>`,
      'i',
    );
    const m = html.match(re);
    const v = m?.[1] ?? m?.[2];
    if (v) return decode(v);
  }
  return undefined;
}

export function parseMeta(html: string, pageUrl: string): LinkMeta {
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ??
    (titleTag ? decode(titleTag) : undefined);
  const description = metaContent(html, [
    'og:description',
    'twitter:description',
    'description',
  ]);
  const siteName = metaContent(html, ['og:site_name']);
  let thumb = metaContent(html, ['og:image', 'twitter:image']);
  if (thumb) {
    try {
      thumb = new URL(thumb, pageUrl).href;
    } catch {
      thumb = undefined;
    }
  }
  let provider: string | undefined;
  try {
    provider = new URL(pageUrl).hostname;
  } catch {
    provider = undefined;
  }
  const meta: LinkMeta = {};
  if (title) meta.title = title;
  if (description) meta.description = description;
  if (siteName) meta.siteName = siteName;
  if (thumb) meta.thumb = thumb;
  if (provider) meta.provider = provider;
  return meta;
}

async function readCapped(res: Response, max = UNFURL_MAX_BYTES): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > max) throw new UnfurlError();
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(out);
}

export async function unfurl(
  raw: string,
  opts: { lookup?: LookupFn; fetch?: FetchFn } = {},
): Promise<LinkMeta> {
  const lookup = opts.lookup ?? defaultLookup;
  const doFetch = opts.fetch ?? fetch;
  let url = await assertSafeUrl(raw, lookup);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), UNFURL_TIMEOUT_MS);
  try {
    for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
      const res = await doFetch(url.href, {
        method: 'GET',
        redirect: 'manual',
        signal: ac.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Margin/0.1',
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) throw new UnfurlError();
        url = await assertSafeUrl(new URL(loc, url).href, lookup);
        continue;
      }
      if (!res.ok) throw new UnfurlError();
      const html = await readCapped(res);
      return parseMeta(html, url.href);
    }
    throw new UnfurlError();
  } catch (err) {
    if (err instanceof UnfurlError) throw err;
    throw new UnfurlError();
  } finally {
    clearTimeout(timer);
  }
}
