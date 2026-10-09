'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Board, User } from '@/lib/types';
import { authClient } from '@/lib/auth/client';

interface Props {
  boards: Board[];
  currentId: string;
  user: User | null;
  onSwitch(id: string): void;
  onCreate(): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onExport(id: string): void;
  onImport(text: string): string | null;
  onClose(): void;
  startRenaming?: boolean;
}

export default function BoardsMenu(props: Props) {
  const current = props.boards.find((b) => b.id === props.currentId);
  const [renaming, setRenaming] = useState(!!props.startRenaming);
  const [name, setName] = useState(current ? current.name : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(current ? current.name : '');
    setConfirmDelete(false);
  }, [props.currentId, current]);

  useEffect(() => {
    if (props.startRenaming) setRenaming(true);
  }, [props.startRenaming, props.currentId]);

  // Ephemeral: closes on any outside press or Escape.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        ref.current &&
        t &&
        !ref.current.contains(t) &&
        !t.closest('[data-boards-toggle]')
      )
        props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [props]);

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (current && name.trim()) props.onRename(current.id, name.trim());
    setRenaming(false);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const text = await f.text();
    setError(props.onImport(text));
  }

  const sorted = [...props.boards].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <div
      className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] left-1/2 z-30 grid w-80 max-h-[min(520px,calc(100vh-120px))] max-w-[calc(100vw-24px)] -translate-x-1/2 gap-2 overflow-auto rounded-xl border border-stone-100 bg-white p-3 shadow-xl"
      ref={ref}
      role="dialog"
      aria-label="Boards">
      <div className="font-mono text-[11px] font-medium tracking-widest text-sky-700 uppercase">
        Boards
      </div>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {sorted.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              className={
                'flex w-full cursor-pointer justify-between gap-2.5 rounded-md border-0 bg-transparent px-2 py-1.5 text-left hover:bg-zinc-900/5' +
                (b.id === props.currentId ? ' bg-sky-100 font-semibold' : '')
              }
              aria-current={b.id === props.currentId ? 'true' : undefined}
              onClick={() => props.onSwitch(b.id)}>
              <span className="min-w-0 truncate">{b.name}</span>
              <span className="font-mono text-[11.5px] leading-relaxed text-zinc-400 tabular-nums">
                {b.items.length}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="w-full cursor-pointer whitespace-nowrap rounded-md border border-dashed border-stone-300 bg-transparent px-2.5 py-1 text-left text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
        onClick={props.onCreate}>
        + New board
      </button>

      {current && (
        <div className="grid gap-2 border-t border-stone-300 pt-2.5">
          {renaming ? (
            <form
              onSubmit={submitRename}
              className="flex items-center gap-2">
              <input
                id="board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                aria-label="Board name"
                onFocus={(e) => e.currentTarget.select()}
                className="w-full min-w-0 rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-1.5 focus:outline-2 focus:-outline-offset-1 focus:outline-sky-700"
              />
              <button
                type="submit"
                className="inline-block cursor-pointer whitespace-nowrap rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-[13px] font-semibold text-stone-100 no-underline disabled:cursor-default disabled:opacity-40">
                Save
              </button>
            </form>
          ) : confirmDelete ? (
            <div className="grid gap-2 text-[13px]">
              <span>
                Delete &ldquo;{current.name}&rdquo; and its{' '}
                {current.items.length} box
                {current.items.length === 1 ? '' : 'es'}? This can&rsquo;t be
                undone.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer whitespace-nowrap rounded-md border border-red-700 bg-transparent px-2.5 py-1 text-[13px] text-red-700"
                  onClick={() => props.onDelete(current.id)}>
                  Delete board
                </button>
                <button
                  type="button"
                  className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
                  onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
                onClick={() => setRenaming(true)}>
                Rename
              </button>
              <button
                type="button"
                className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
                onClick={() => props.onExport(current.id)}>
                Export
              </button>
              <button
                type="button"
                className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
                onClick={() => fileRef.current?.click()}>
                Import
              </button>
              <button
                type="button"
                className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
                onClick={() => setConfirmDelete(true)}
                disabled={props.boards.length < 2}
                title={
                  props.boards.length < 2
                    ? 'Keep at least one board'
                    : undefined
                }>
                Delete
              </button>
            </div>
          )}
          {error && <p className="m-0 text-[13px] text-red-700">{error}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onFile(e)}
          />
        </div>
      )}

      {props.user && (
        <div className="flex items-center justify-between gap-2 border-t border-stone-300 pt-2.5">
          <span
            className="min-w-0 truncate text-[13px] text-zinc-500"
            title={props.user.email}>
            {props.user.name || props.user.email}
          </span>
          <button
            type="button"
            className="cursor-pointer whitespace-nowrap rounded-md border border-stone-300 bg-transparent px-2.5 py-1 text-[13px] hover:border-zinc-400 disabled:cursor-default disabled:opacity-40"
            onClick={() => {
              void authClient.signOut().then(() => {
                window.location.href = '/auth/sign-in';
              });
            }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
