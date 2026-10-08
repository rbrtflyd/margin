import { createNeonAuth } from '@neondatabase/auth/next/server';

/**
 * Neon Auth (managed Better Auth). It switches on when both env vars are set.
 * Until then `auth` is null and the app runs signed-out, with /api/ask gated by APP_PASSCODE.
 */
const baseUrl = process.env.NEON_AUTH_BASE_URL;
const secret = process.env.NEON_AUTH_COOKIE_SECRET;

export const auth =
  baseUrl && secret
    ? createNeonAuth({
        baseUrl,
        cookies: { secret },
      })
    : null;

export const authEnabled = auth !== null;
