import type { AskRequest } from './types';

/**
 * How the assistant behaves. This is the product's core stance, so it lives in one place.
 * Server-only: imported by app/api/ask/route.ts.
 */
export const SYSTEM_PROMPT = `You are the assistant inside Margin, a canvas where a product designer thinks in loose text boxes.

Each box is free text. It might be an idea, a question, a note to self, a quote from a call, a task, a link, or a mix. Interpret them yourself; never ask the designer to label or sort anything. Position is a hint: boxes close together are probably related.

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
    const text = it.text.length > MAX_ITEM_CHARS ? it.text.slice(0, MAX_ITEM_CHARS) + ' [cut]' : it.text;
    const line = `[${it.id}] (${Math.round(it.x)}, ${Math.round(it.y)})${it.by === 'claude' ? ' written by you earlier' : ''}${selected.has(it.id) ? ' SELECTED' : ''}\n${text}`;
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
  return `Board: "${req.boardName}"\nToday: ${new Date().toDateString()}\n${scope}\n\nBoxes (id, position, text):\n\n${lines.join('\n\n') || '(the board is empty)'}`;
}

/** Returns a clean request or an error message. */
export function validateAsk(body: unknown): AskRequest | string {
  if (!body || typeof body !== 'object') return 'Malformed request.';
  const b = body as Record<string, unknown>;
  const question = typeof b.question === 'string' ? b.question.trim() : '';
  if (!question) return 'Ask something first.';
  if (question.length > 8000) return 'That message is too long.';
  const items = Array.isArray(b.items) ? b.items : [];
  const clean: AskRequest['items'] = [];
  for (const raw of items.slice(0, 2000)) {
    if (!raw || typeof raw !== 'object') continue;
    const i = raw as Record<string, unknown>;
    if (typeof i.id !== 'string' || typeof i.text !== 'string') continue;
    clean.push({
      id: i.id.slice(0, 40),
      text: i.text,
      x: typeof i.x === 'number' ? i.x : 0,
      y: typeof i.y === 'number' ? i.y : 0,
      by: i.by === 'claude' ? 'claude' : 'me',
    });
  }
  const selectedIds = Array.isArray(b.selectedIds) ? b.selectedIds.filter((x): x is string => typeof x === 'string').slice(0, 2000) : [];
  const history = Array.isArray(b.history)
    ? b.history
        .filter((h): h is { q: string; a: string } => !!h && typeof h === 'object' && typeof (h as { q?: unknown }).q === 'string' && typeof (h as { a?: unknown }).a === 'string')
        .slice(-6)
        .map((h) => ({ q: h.q.slice(0, 4000), a: h.a.slice(0, 8000) }))
    : [];
  return {
    question,
    boardName: typeof b.boardName === 'string' ? b.boardName.slice(0, 200) : 'Untitled board',
    items: clean,
    selectedIds,
    history,
  };
}
