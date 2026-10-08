import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import NotConfigured from '@/components/NotConfigured';
import { auth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  if (!auth) return <NotConfigured />;
  const { data: session } = await auth.getSession();
  if (session?.user) redirect('/');
  return <AuthForm mode="sign-up" />;
}
