import { isAuthenticated } from '@/lib/auth/server';
import { unfurl, UnfurlError } from '@/lib/unfurl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!(await isAuthenticated())) {
    return fail(401, 'Your session ended. Sign in again.');
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Malformed request.');
  }
  const url =
    body && typeof body === 'object' && 'url' in body
      ? (body as { url: unknown }).url
      : undefined;
  if (typeof url !== 'string' || !url.trim()) return fail(400, 'Missing url.');
  try {
    const meta = await unfurl(url.trim());
    return Response.json(meta);
  } catch (err) {
    if (err instanceof UnfurlError) return fail(422, 'Could not unfurl that link.');
    return fail(422, 'Could not unfurl that link.');
  }
}
