'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuthActions } from '@convex-dev/auth/react';

export default function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialPending, setSocialPending] = useState(false);

  async function withGoogle() {
    setSocialError(null);
    setSocialPending(true);
    try {
      await signIn('google');
    } catch {
      setSocialError('Couldn’t start Google sign-in. Add AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET on the Convex deployment.');
      setSocialPending(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set('flow', isSignUp ? 'signUp' : 'signIn');
    try {
      await signIn('password', formData);
      window.location.assign('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/invalidaccountid|invalidsecret|invalid password/i.test(message)) {
        setError('Couldn’t sign in. Check your email and password.');
      } else if (/already exists|already used/i.test(message)) {
        setError('An account with that email already exists. Sign in instead.');
      } else {
        setError(isSignUp ? 'Couldn’t create the account.' : 'Couldn’t sign in. Check your email and password.');
      }
      setPending(false);
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

        <form onSubmit={(e) => void onSubmit(e)} className="auth-fields">
          {isSignUp && (
            <label>
              <span>Name</span>
              <input id="auth-name" name="name" type="text" autoComplete="name" />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
          {error && <p className="err-text">{error}</p>}
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
