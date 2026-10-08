'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { signInWithEmail, signUpWithEmail } from '@/app/auth/actions';
import type { AuthState } from '@/app/auth/actions';
import { authClient } from '@/lib/auth/client';

export default function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  const [state, formAction, pending] = useActionState<AuthState, FormData>(isSignUp ? signUpWithEmail : signInWithEmail, null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialPending, setSocialPending] = useState(false);

  async function withGoogle() {
    setSocialError(null);
    setSocialPending(true);
    try {
      // Redirects to Google, then back to "/" with a session.
      const res = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
      if (res && res.error) {
        setSocialError(res.error.message || 'Google sign-in isn’t available. Check the providers in Neon Auth.');
        setSocialPending(false);
      }
    } catch {
      setSocialError('Couldn’t start Google sign-in. Try again.');
      setSocialPending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Margin</div>
        <h1>{isSignUp ? 'Create your account' : 'Sign in'}</h1>

        <button type="button" className="auth-social" onClick={() => void withGoogle()} disabled={socialPending || pending}>
          {socialPending ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {socialError && <p className="err-text">{socialError}</p>}

        <div className="auth-or">
          <span>or with email</span>
        </div>

        <form action={formAction} className="auth-fields">
          {isSignUp && (
            <label>
              <span>Name</span>
              <input id="auth-name" name="name" type="text" autoComplete="name" />
            </label>
          )}
          <label>
            <span>Email</span>
            <input id="auth-email" name="email" type="email" autoComplete="email" defaultValue={state?.email ?? ''} required />
          </label>
          <label>
            <span>Password</span>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>
          {state && state.error && <p className="err-text">{state.error}</p>}
          <button type="submit" className="primary-btn auth-submit" disabled={pending || socialPending}>
            {pending ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? (
            <>
              Have an account? <Link href="/auth/sign-in">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/auth/sign-up">Create an account</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
