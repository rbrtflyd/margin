'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';

// email is echoed back so the field survives React's form reset after a failed attempt.
export type AuthState = { error: string; email?: string } | null;

const NOT_SET_UP = 'Sign-in isn’t set up yet. Add NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET.';

export async function signInWithEmail(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!auth) return { error: NOT_SET_UP };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.', email };

  const { error } = await auth.signIn.email({ email, password });
  if (error) return { error: error.message || 'Couldn’t sign in. Check your email and password.', email };

  redirect('/');
}

export async function signUpWithEmail(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!auth) return { error: NOT_SET_UP };
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter an email and a password.', email };

  const { error } = await auth.signUp.email({ name: name || email.split('@')[0], email, password });
  if (error) return { error: error.message || 'Couldn’t create the account.', email };

  redirect('/');
}

export async function signOut(): Promise<void> {
  if (auth) await auth.signOut();
  redirect('/auth/sign-in');
}
