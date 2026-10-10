'use client';

import type { User } from '@/lib/types';
import { authClient } from '@/lib/auth/client';
import { Island } from './Island';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function UserMenu({ user }: { user: User | null }) {
  if (!user) return null;

  const label = user.name || user.email;

  return (
    <Island
      position="top-right"
      className="p-1"
      aria-label="Account">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex max-w-[180px] min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-[13.5px] whitespace-nowrap hover:bg-zinc-900/10 aria-expanded:bg-zinc-900 aria-expanded:text-stone-100">
          <span className="truncate">{label}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden="true">
            <path
              d="M2 4l3 3 3-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">
              {user.email}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              void authClient.signOut().then(() => {
                window.location.href = '/auth/sign-in';
              });
            }}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Island>
  );
}
