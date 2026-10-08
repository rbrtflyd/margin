import { isConvexConfigured } from '@/lib/env';

/**
 * Convex Auth switches on when NEXT_PUBLIC_CONVEX_URL is set.
 * Until then the app runs signed-out, with /api/ask gated by APP_PASSCODE.
 */
export const authEnabled = isConvexConfigured();
