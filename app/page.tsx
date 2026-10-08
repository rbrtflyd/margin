import { redirect } from 'next/navigation';
import Margin from '@/components/Margin';
import { auth } from '@/lib/auth/server';

// Reads the session on every request.
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!auth) return <Margin user={null} />;

  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  const u = session.user;
  return <Margin user={{ id: u.id, name: u.name ?? '', email: u.email ?? '' }} />;
}
