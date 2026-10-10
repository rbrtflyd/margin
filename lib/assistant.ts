import { anthropic } from '@ai-sdk/anthropic';
import type { AskBox, AskEdge, AskRequest } from './types';

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const HISTORY_MESSAGES = 13;

/** Later BYOK seam: swap this for OpenAI or a user-supplied key. Server-only. */
export function languageModel() {
  return anthropic(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL);
}

/**
 * How the assistant behaves. This is the product's core stance, so it lives in one place.
 * Server-only: imported by app/api/ask/route.ts.
 */
export const SYSTEM_PROMPT = `You are the assistant inside Margin, a canvas where a product designer thinks in loose text boxes.

Each box is free text. It might be an idea, a question, a note to self, a quote from a call, a task, a link, or a mix. Interpret them yourself; never ask the designer to label or sort anything. Position is a hint: boxes close together are probably related. Lines between boxes are connections, sometimes with a label; treat them as how boxes relate, not as items of their own. Don't invent connections that aren't listed. Images and link cards are on the board too: read their captions, titles, and URLs. You do not see image pixels.

Your role is assistant and rubber duck, not co-designer:
- Surface what is already on the board that bears on their message. Quote a few words of a box so they can find it.
- Reflect what you see: overlaps, tensions, open questions, things that seem to have changed or been left hanging.
- Give honest, specific feedback when they ask for it.
- When they are thinking out loud, ask one or two questions that help them examine their own thinking.

Do not propose new product ideas, features, solutions, flows or names unless their message explicitly asks for ideas.
Never invent content that is not on the board. If something isn't there, say so plainly. If you use general knowledge, label it as general knowledge.
When they have selected boxes, focus on those; the rest of the board is context.

Write plain text in short paragraphs. No headings, no bold, no bullet lists unless they ask. Keep it under 150 words unless they ask for more.`;

const MAX_ITEM_CHARS = 4000;
const MAX_BOARD_CHARS = 150_000;

export function boardContext(req: AskRequest): string {
  const selected = new Set(req.selectedIds);
  const ordered = [...req.items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: string[] = [];
  let used = 0;
  for (const it of ordered) {
    const line =
      `[${it.id}] (${Math.round(it.x)}, ${Math.round(it.y)})${it.by === 'claude' ? ' written by you earlier' : ''}${selected.has(it.id) ? ' SELECTED' : ''}\n` +
      formatBoxBody(it);
    if (used + line.length > MAX_BOARD_CHARS) {
      lines.push(`[${ordered.length - lines.length} more boxes not shown: the board is too large to send in full]`);
      break;
    }
    lines.push(line);
    used += line.length;
  }
  const scope = selected.size
    ? `They selected ${selected.size} box${selected.size === 1 ? '' : 'es'} (marked SELECTED).`
    : 'Nothing is selected, so they mean the whole board.';
  const connections =
    req.edges.length === 0
      ? ''
      : `\n\nConnections:\n${req.edges.map(formatEdge).join('\n')}`;
  return `Board: "${req.boardName}"\nToday: ${new Date().toDateString()}\n${scope}\n\nBoxes (id, position, text):\n\n${lines.join('\n\n') || '(the board is empty)'}${connections}`;
}

function clip(s: string): string {
  return s.length > MAX_ITEM_CHARS ? s.slice(0, MAX_ITEM_CHARS) + ' [cut]' : s;
}

function formatBoxBody(it: AskBox): string {
  const parts: string[] = [];
  if (it.text.trim()) parts.push(clip(it.text));
  if (it.caption) parts.push('caption: ' + clip(it.caption));
  if (it.title) parts.push('title: ' + clip(it.title));
  if (it.description) parts.push('description: ' + clip(it.description));
  if (it.url) parts.push('url: ' + clip(it.url));
  return parts.join('\n') || '(empty)';
}

function formatEdge(e: AskEdge): string {
  const from = e.from ? `[${e.from}]` : '(free)';
  const to = e.to ? `[${e.to}]` : '(free)';
  const label = e.label.trim();
  return label ? `${from} --${label}--> ${to}` : `${from} --> ${to}`;
}

function lastUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== 'object') continue;
    const rec = m as Record<string, unknown>;
    if (rec.role !== 'user' || !Array.isArray(rec.parts)) continue;
    const text = rec.parts
      .map((p) => {
        if (!p || typeof p !== 'object') return '';
        const part = p as Record<string, unknown>;
        return part.type === 'text' && typeof part.text === 'string' ? part.text : '';
      })
      .join('');
    return text.trim();
  }
  return '';
}

/** Last 6 completed exchanges plus the current user message. */
export function recentAskMessages(messages: unknown): unknown[] {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-HISTORY_MESSAGES);
}

/** Returns a clean request or an error message. */
export function validateAsk(body: unknown): AskRequest | string {
  if (!body || typeof body !== 'object') return 'Malformed request.';
  const b = body as Record<string, unknown>;
  const question = (typeof b.question === 'string' ? b.question.trim() : '') || lastUserText(b.messages);
  if (!question) return 'Ask something first.';
  if (question.length > 8000) return 'That message is too long.';
  const items = Array.isArray(b.items) ? b.items : [];
  const clean: AskRequest['items'] = [];
  for (const raw of items.slice(0, 2000)) {
    if (!raw || typeof raw !== 'object') continue;
    const i = raw as Record<string, unknown>;
    if (typeof i.id !== 'string' || typeof i.text !== 'string') continue;
    const box: AskBox = {
      id: i.id.slice(0, 40),
      text: i.text,
      x: typeof i.x === 'number' ? i.x : 0,
      y: typeof i.y === 'number' ? i.y : 0,
      by: i.by === 'claude' ? 'claude' : 'me',
    };
    if (typeof i.url === 'string' && i.url) box.url = i.url.slice(0, 2000);
    if (typeof i.title === 'string' && i.title) box.title = i.title.slice(0, 500);
    if (typeof i.description === 'string' && i.description)
      box.description = i.description.slice(0, 2000);
    if (typeof i.caption === 'string' && i.caption)
      box.caption = i.caption.slice(0, 2000);
    clean.push(box);
  }
  const selectedIds = Array.isArray(b.selectedIds) ? b.selectedIds.filter((x): x is string => typeof x === 'string').slice(0, 2000) : [];
  const history = Array.isArray(b.history)
    ? b.history
        .filter((h): h is { q: string; a: string } => !!h && typeof h === 'object' && typeof (h as { q?: unknown }).q === 'string' && typeof (h as { a?: unknown }).a === 'string')
        .slice(-6)
        .map((h) => ({ q: h.q.slice(0, 4000), a: h.a.slice(0, 8000) }))
    : [];
  const edges: AskEdge[] = [];
  if (Array.isArray(b.edges)) {
    for (const raw of b.edges.slice(0, 2000)) {
      if (!raw || typeof raw !== 'object') continue;
      const e = raw as Record<string, unknown>;
      const from =
        e.from === null || typeof e.from === 'string' ? e.from : null;
      const to = e.to === null || typeof e.to === 'string' ? e.to : null;
      edges.push({
        from: typeof from === 'string' ? from.slice(0, 40) : null,
        to: typeof to === 'string' ? to.slice(0, 40) : null,
        label: typeof e.label === 'string' ? e.label.slice(0, 4000) : '',
      });
    }
  }
  return {
    question,
    boardName: typeof b.boardName === 'string' ? b.boardName.slice(0, 200) : 'Untitled board',
    items: clean,
    edges,
    selectedIds,
    history,
  };
}
