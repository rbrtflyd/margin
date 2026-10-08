import { redirect } from 'next/navigation';
import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import AuthForm from '@/components/AuthForm';
import NotConfigured from '@/components/NotConfigured';
import { isConvexConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  if (!isConvexConfigured()) return <NotConfigured />;
  if (await isAuthenticatedNextjs()) redirect('/');
  return <AuthForm mode="sign-in" />;
}
