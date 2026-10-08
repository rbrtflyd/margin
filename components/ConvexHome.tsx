'use client';

import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { api } from '@/convex/_generated/api';
import type { Store } from '@/lib/types';
import Margin from './Margin';

export default function ConvexHome() {
  const router = useRouter();
  const user = useQuery(api.users.me);
  const remote = useQuery(api.stores.get, user ? {} : 'skip');
  const save = useMutation(api.stores.save);
  const persist = useCallback(
    (s: Store) => {
      void save({ v: 1, boards: s.boards, currentId: s.currentId });
    },
    [save],
  );
  const sync = useMemo(() => ({ remote, save: persist }), [remote, persist]);

  useEffect(() => {
    if (user === null) router.replace('/auth/sign-in');
  }, [user, router]);

  if (user === undefined || user === null) return <div className="app" />;

  return <Margin user={user} sync={sync} />;
}
