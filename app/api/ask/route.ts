import { SYSTEM_PROMPT, boardContext, validateAsk } from '@/lib/assistant';
import { auth } from '@/lib/auth/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_MODEL = 'claude-sonnet-5-5';

type StreamEvent = {
  type: string;
  delta?: { type?: string; text?: string };
  error?: { message?: string };
};

function fail(status: number, message: string, code?: 'signin' | 'passcode'): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  // This route spends your API credit. With Neon Auth configured it needs a signed-in session;
  // without it, a passcode gates it on Vercel.
  if (auth) {
    const { data: session } = await auth.getSession();
    if (!session?.user) return fail(401, 'Your session ended. Sign in again to keep asking.', 'signin');
  } else {
    const passcode = process.env.APP_PASSCODE;
    if (process.env.VERCEL && !passcode) {
      return fail(500, 'Set APP_PASSCODE in Vercel (Settings, Environment Variables), then redeploy.');
    }
    if (passcode && req.headers.get('x-margin-passcode') !== passcode) {
      return fail(401, 'Enter the passcode to ask.', 'passcode');
    }
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
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

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const h of ask.history) {
    messages.push({ role: 'user', content: h.q });
    messages.push({ role: 'assistant', content: h.a || '(no answer)' });
  }
  messages.push({ role: 'user', content: `${boardContext(ask)}\n\n---\nTheir message:\n${ask.question}` });

  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      }),
      signal: req.signal,
    });
  } catch {
    return fail(502, 'Couldn’t reach Claude. Try again in a moment.');
  }

  if (!upstream.ok || !upstream.body) {
    let detail = '';
    try {
      const j = (await upstream.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? '';
    } catch {
      // no JSON body
    }
    if (upstream.status === 401) return fail(500, 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.');
    if (upstream.status === 429) return fail(429, 'Rate limited by the Anthropic API. Try again shortly.');
    return fail(502, 'Claude returned an error' + (detail ? `: ${detail}` : '.'));
  }

  // Turn Anthropic's server-sent events into a plain text stream of the answer.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buf = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl = buf.indexOf('\n');
          while (nl >= 0) {
            const line = buf.slice(0, nl).trimEnd();
            buf = buf.slice(nl + 1);
            nl = buf.indexOf('\n');
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            let ev: StreamEvent;
            try {
              ev = JSON.parse(data) as StreamEvent;
            } catch {
              continue;
            }
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && typeof ev.delta.text === 'string') {
              controller.enqueue(encoder.encode(ev.delta.text));
            } else if (ev.type === 'error') {
              controller.enqueue(encoder.encode(`\n\n[Claude stopped: ${ev.error?.message ?? 'error'}]`));
            }
          }
        }
      } catch {
        controller.enqueue(encoder.encode('\n\n[The connection to Claude was interrupted.]'));
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}
