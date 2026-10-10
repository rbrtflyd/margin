const YT_ID = /^[\w-]{11}$/;

function host(url: URL): string {
  return url.hostname.replace(/^www\./, '').toLowerCase();
}

function youtubeId(url: URL): string | null {
  const h = host(url);
  if (h === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    return YT_ID.test(id) ? id : null;
  }
  if (h === 'youtube.com' || h === 'youtube-nocookie.com' || h === 'm.youtube.com') {
    const v = url.searchParams.get('v');
    if (v && YT_ID.test(v)) return v;
    const parts = url.pathname.split('/').filter(Boolean);
    if (
      (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') &&
      parts[1] &&
      YT_ID.test(parts[1])
    )
      return parts[1];
  }
  return null;
}

function vimeoId(url: URL): string | null {
  if (host(url) !== 'vimeo.com' && host(url) !== 'player.vimeo.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const id = host(url) === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0];
  return id && /^\d+$/.test(id) ? id : null;
}

function loomId(url: URL): string | null {
  if (host(url) !== 'loom.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if ((parts[0] === 'share' || parts[0] === 'embed') && parts[1]) return parts[1];
  return null;
}

function figmaSrc(url: URL): string | null {
  const h = host(url);
  if (h !== 'figma.com' && h !== 'embed.figma.com') return null;
  const path = url.pathname;
  if (
    !path.startsWith('/file/') &&
    !path.startsWith('/design/') &&
    !path.startsWith('/proto/') &&
    !path.startsWith('/board/')
  )
    return null;
  const src = new URL('https://embed.figma.com' + path);
  src.search = url.search;
  if (!src.searchParams.has('embed-host')) src.searchParams.set('embed-host', 'share');
  return src.href;
}

function googleSrc(url: URL): string | null {
  if (host(url) !== 'docs.google.com') return null;
  const m = url.pathname.match(
    /^\/(presentation|document)\/d\/([^/]+)(?:\/.*)?$/,
  );
  if (!m) return null;
  const kind = m[1] === 'presentation' ? 'embed' : 'preview';
  return `https://docs.google.com/${m[1]}/d/${m[2]}/${kind}`;
}

function codepenSrc(url: URL): string | null {
  if (host(url) !== 'codepen.io') return null;
  const m = url.pathname.match(/^\/([^/]+)\/(?:pen|embed)\/([^/]+)/);
  if (!m) return null;
  return `https://codepen.io/${m[1]}/embed/${m[2]}`;
}

function spotifySrc(url: URL): string | null {
  if (host(url) !== 'open.spotify.com') return null;
  const m = url.pathname.match(
    /^\/(track|album|playlist|episode|show)\/([^/]+)/,
  );
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
}

/** Allowlisted iframe src, or null to keep a link card. */
export function embedSrc(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const yt = youtubeId(url);
  if (yt) return 'https://www.youtube-nocookie.com/embed/' + yt;
  const vim = vimeoId(url);
  if (vim) return 'https://player.vimeo.com/video/' + vim;
  const loom = loomId(url);
  if (loom) return 'https://www.loom.com/embed/' + loom;
  const figma = figmaSrc(url);
  if (figma) return figma;
  const google = googleSrc(url);
  if (google) return google;
  const pen = codepenSrc(url);
  if (pen) return pen;
  const spotify = spotifySrc(url);
  if (spotify) return spotify;
  return null;
}

export function embedAllow(raw: string): string {
  const src = embedSrc(raw) ?? raw;
  if (src.includes('youtube-nocookie.com') || src.includes('youtube.com')) {
    return 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  }
  if (src.includes('vimeo.com') || src.includes('loom.com')) {
    return 'autoplay; fullscreen; picture-in-picture';
  }
  if (src.includes('spotify.com')) return 'encrypted-media; autoplay';
  if (src.includes('figma.com')) return 'fullscreen';
  return 'fullscreen; autoplay';
}

export function canEmbed(raw: string | undefined): boolean {
  return !!raw && !!embedSrc(raw);
}
