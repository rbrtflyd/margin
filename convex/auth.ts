import Google from '@auth/core/providers/google';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import type { DataModel } from './_generated/dataModel';

const password = Password<DataModel>({
  profile(params) {
    const email = String(params.email ?? '');
    const name = String(params.name ?? '').trim();
    return { email, name: name || email.split('@')[0] || email };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: process.env.AUTH_GOOGLE_ID ? [password, Google] : [password],
});
