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
    <main className="fixed inset-0 grid place-items-center overflow-auto bg-stone-100 bg-[radial-gradient(circle,#d6d3d1_1px,transparent_1.2px)] bg-size-[24px_24px] px-4 py-6">
      <div className="grid w-full max-w-[360px] gap-3.5 rounded-xl border border-stone-300 bg-white px-[22px] pt-[22px] pb-[18px] shadow-xl">
        <div className="flex items-center gap-2.5 text-[15px] font-bold">
          <span className="h-[18px] w-[5px] border-x-[1.5px] border-sky-700" aria-hidden />
          Margin
        </div>
        <h1 className="m-0 font-serif text-[26px] leading-tight font-normal italic">{isSignUp ? 'Create your account' : 'Sign in'}</h1>

        <button
          type="button"
          className="w-full cursor-pointer rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 font-semibold hover:border-zinc-400 disabled:cursor-default disabled:opacity-60"
          onClick={() => void withGoogle()}
          disabled={socialPending || pending}
        >
          {socialPending ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {socialError && <p className="m-0 text-[13px] text-red-700">{socialError}</p>}

        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-widest text-zinc-400 uppercase">
          <span className="h-px flex-1 bg-stone-300" />
          or with email
          <span className="h-px flex-1 bg-stone-300" />
        </div>

        <form action={formAction} className="grid gap-3">
          {isSignUp && (
            <label className="grid gap-1 text-[13px] text-zinc-500">
              <span>Name</span>
              <input id="auth-name" name="name" type="text" autoComplete="name" className="w-full min-w-0 rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-1.5 focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700" />
            </label>
          )}
          <label className="grid gap-1 text-[13px] text-zinc-500">
            <span>Email</span>
            <input id="auth-email" name="email" type="email" autoComplete="email" defaultValue={state?.email ?? ''} required className="w-full min-w-0 rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-1.5 focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700" />
          </label>
          <label className="grid gap-1 text-[13px] text-zinc-500">
            <span>Password</span>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              required
              className="w-full min-w-0 rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-1.5 focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700"
            />
          </label>
          {state && state.error && <p className="m-0 text-[13px] text-red-700">{state.error}</p>}
          <button type="submit" className="inline-block cursor-pointer whitespace-nowrap rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-stone-100 no-underline disabled:cursor-default disabled:opacity-40" disabled={pending || socialPending}>
            {pending ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="m-0 text-[13px] text-zinc-500">
          {isSignUp ? (
            <>
              Have an account?{' '}
              <Link href="/auth/sign-in" className="text-sky-800">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link href="/auth/sign-up" className="text-sky-800">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
