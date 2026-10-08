import { auth } from '@/lib/auth/server';

function notConfigured(): Response {
  return Response.json(
    { error: 'Sign-in isn’t set up yet. Add NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET.' },
    { status: 503 },
  );
}

const handlers = auth ? auth.handler() : { GET: notConfigured, POST: notConfigured };

export const GET = handlers.GET;
export const POST = handlers.POST;
