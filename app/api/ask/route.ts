import { APICallError, ToolLoopAgent, createAgentUIStreamResponse } from 'ai';
import {
  SYSTEM_PROMPT,
  boardContext,
  languageModel,
  recentAskMessages,
  validateAsk,
} from '@/lib/assistant';
import { isAuthenticated } from '@/lib/auth/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function fail(status: number, message: string, code?: 'signin' | 'passcode'): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!(await isAuthenticated())) {
    return fail(401, 'Your session ended. Sign in again to keep asking.', 'signin');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(500, 'Set ANTHROPIC_API_KEY in your environment, then restart or redeploy.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Malformed request.');
  }
  const ask = validateAsk(body);
  if (typeof ask === 'string') return fail(400, ask);

  const uiMessages = recentAskMessages((body as { messages?: unknown }).messages);
  const agent = new ToolLoopAgent({
    model: languageModel(),
    instructions: `${SYSTEM_PROMPT}\n\n${boardContext(ask)}`,
    maxOutputTokens: 2000,
  });

  try {
    return await createAgentUIStreamResponse({
      agent,
      uiMessages,
      abortSignal: req.signal,
    });
  } catch (err) {
    if (APICallError.isInstance(err)) {
      if (err.statusCode === 401) return fail(500, 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.');
      if (err.statusCode === 429) return fail(429, 'Rate limited by the Anthropic API. Try again shortly.');
      const detail = err.message?.trim();
      return fail(502, 'Claude returned an error' + (detail ? `: ${detail}` : '.'));
    }
    return fail(502, 'Couldn’t reach Claude. Try again in a moment.');
  }
}
