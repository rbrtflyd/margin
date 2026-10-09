import { redirect } from 'next/navigation';
import Margin from '@/components/Margin';
import { fetchAuthQuery, isAuthenticated } from '@/lib/auth/server';
import { api } from '@/convex/_generated/api';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await isAuthenticated())) redirect('/auth/sign-in');
  const user = await fetchAuthQuery(api.auth.getCurrentUser);
  if (!user) redirect('/auth/sign-in');
  return <Margin user={user} />;
}
