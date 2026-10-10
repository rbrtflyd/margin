'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Board } from '@/lib/types';
import { Island } from './Island';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  boards: Board[];
  currentId: string;
  startRenaming?: boolean;
  onSwitch(id: string): void;
  onCreate(): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onExport(id: string): void;
  onImport(text: string): string | null;
}

export default function BoardSwitcher(props: Props) {
  const current = props.boards.find((b) => b.id === props.currentId);
  const [renaming, setRenaming] = useState(!!props.startRenaming);
  const [name, setName] = useState(current ? current.name : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(current ? current.name : '');
    setConfirmDelete(false);
  }, [props.currentId, current]);

  useEffect(() => {
    if (props.startRenaming) setRenaming(true);
  }, [props.startRenaming, props.currentId]);

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (current && name.trim()) props.onRename(current.id, name.trim());
    setRenaming(false);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setError(props.onImport(await f.text()));
  }

  const sorted = [...props.boards].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  if (renaming && current) {
    return (
      <Island
        position="top-left"
        className="p-1"
        aria-label="Rename board">
        <form
          onSubmit={submitRename}
          className="flex items-center gap-1">
          <input
            id="board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-label="Board name"
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setName(current.name);
                setRenaming(false);
              }
            }}
            className="w-44 min-w-0 rounded-lg border border-stone-100 bg-stone-100 px-2.5 py-1.5 text-[13.5px] font-semibold focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700"
          />
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center rounded-lg border-0 bg-zinc-900 px-2.5 py-1.5 text-[13px] font-semibold text-stone-100">
            Save
          </button>
        </form>
      </Island>
    );
  }

  if (confirmDelete && current) {
    return (
      <Island
        position="top-left"
        className="grid max-w-[min(320px,calc(100vw-24px))] gap-2 p-2.5"
        aria-label="Delete board">
        <p className="m-0 text-[13px]">
          Delete &ldquo;{current.name}&rdquo; and its {current.items.length} box
          {current.items.length === 1 ? '' : 'es'}? This can&rsquo;t be undone.
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-red-700 bg-transparent px-2.5 py-1 text-[13px] text-red-700"
            onClick={() => props.onDelete(current.id)}>
            Delete board
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-stone-100 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400"
            onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
        </div>
      </Island>
    );
  }

  return (
    <Island
      position="top-left"
      className="p-1"
      aria-label="Board">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex max-w-[220px] min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-[13.5px] font-semibold whitespace-nowrap hover:bg-zinc-900/10 aria-expanded:bg-zinc-900 aria-expanded:text-stone-100">
          <span className="truncate">{current?.name ?? 'Board'}</span>
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
          align="start"
          sideOffset={8}
          className="w-64 min-w-64">
          <DropdownMenuRadioGroup
            value={props.currentId}
            onValueChange={props.onSwitch}>
            {sorted.map((b) => (
              <DropdownMenuRadioItem
                key={b.id}
                value={b.id}>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <DropdownMenuShortcut className="font-mono tracking-normal">
                  {b.items.length}
                </DropdownMenuShortcut>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={props.onCreate}>New board</DropdownMenuItem>
          {current && (
            <>
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.onExport(current.id)}>
                Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                Import
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={props.boards.length < 2}
                onClick={() => setConfirmDelete(true)}>
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p className="m-0 px-2.5 pb-1.5 text-[12px] text-red-700">{error}</p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void onFile(e)}
      />
    </Island>
  );
}
