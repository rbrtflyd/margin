'use client';

import { createAuthClient } from '@neondatabase/auth/next';

// Talks to /api/auth/* on this app, which proxies to Neon Auth.
export const authClient = createAuthClient();
