export type FormatKind = 'bold' | 'italic' | 'strike' | 'link';

export const FORMAT_EVENT = 'margin:format';

const MARKERS: Record<Exclude<FormatKind, 'link'>, { open: string; close: string }> =
  {
    bold: { open: '**', close: '**' },
    italic: { open: '*', close: '*' },
    strike: { open: '~', close: '~' },
  };

export function wrapSelection(
  text: string,
  start: number,
  end: number,
  kind: FormatKind,
  href = 'https://',
): { text: string; start: number; end: number } {
  const a = Math.max(0, Math.min(start, end, text.length));
  const b = Math.max(0, Math.min(Math.max(start, end), text.length));
  const sel = text.slice(a, b);

  if (kind === 'link') {
    const label = sel || 'link';
    const wrapped = `[${label}](${href})`;
    const next = text.slice(0, a) + wrapped + text.slice(b);
    const labelAt = a + 1;
    return { text: next, start: labelAt, end: labelAt + label.length };
  }

  const { open, close } = MARKERS[kind];
  if (
    a >= open.length &&
    text.slice(a - open.length, a) === open &&
    text.slice(b, b + close.length) === close
  ) {
    const next = text.slice(0, a - open.length) + sel + text.slice(b + close.length);
    return {
      text: next,
      start: a - open.length,
      end: b - open.length,
    };
  }
  if (
    sel.startsWith(open) &&
    sel.endsWith(close) &&
    sel.length >= open.length + close.length
  ) {
    const inner = sel.slice(open.length, sel.length - close.length);
    const next = text.slice(0, a) + inner + text.slice(b);
    return { text: next, start: a, end: a + inner.length };
  }
  const inner = sel || (kind === 'bold' ? 'bold' : kind === 'italic' ? 'italic' : 'strike');
  const wrapped = open + inner + close;
  const next = text.slice(0, a) + wrapped + text.slice(b);
  return {
    text: next,
    start: a + open.length,
    end: a + open.length + inner.length,
  };
}
