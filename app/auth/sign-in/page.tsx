import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { isAuthenticated } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  if (await isAuthenticated()) redirect('/');
  return <AuthForm mode="sign-in" />;
}
