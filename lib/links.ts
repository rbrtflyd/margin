/** A single http(s) URL on one line, or null. */
export function isLoneUrl(text: string): string | null {
  const t = text.trim();
  if (!t || /[\s]/.test(t)) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}
