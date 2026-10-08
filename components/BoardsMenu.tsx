'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Board, User } from '@/lib/types';
import { signOut } from '@/app/auth/actions';

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
      if (ref.current && t && !ref.current.contains(t) && !t.closest('[data-boards-toggle]')) props.onClose();
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

  const sorted = [...props.boards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="float boards" ref={ref} role="dialog" aria-label="Boards">
      <div className="eyebrow">Boards</div>
      <ul className="board-list">
        {sorted.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              className={'board-row' + (b.id === props.currentId ? ' current' : '')}
              aria-current={b.id === props.currentId ? 'true' : undefined}
              onClick={() => props.onSwitch(b.id)}
            >
              <span className="board-name">{b.name}</span>
              <span className="board-count">{b.items.length}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ghost-btn wide" onClick={props.onCreate}>
        + New board
      </button>

      {current && (
        <div className="board-tools">
          {renaming ? (
            <form onSubmit={submitRename} className="row">
              <input id="board-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Board name" onFocus={(e) => e.currentTarget.select()} />
              <button type="submit" className="primary-btn">
                Save
              </button>
            </form>
          ) : confirmDelete ? (
            <div className="confirm">
              <span>
                Delete &ldquo;{current.name}&rdquo; and its {current.items.length} box{current.items.length === 1 ? '' : 'es'}? This can&rsquo;t be undone.
              </span>
              <div className="row">
                <button type="button" className="danger-btn" onClick={() => props.onDelete(current.id)}>
                  Delete board
                </button>
                <button type="button" className="ghost-btn" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <div className="row wrap">
              <button type="button" className="ghost-btn" onClick={() => setRenaming(true)}>
                Rename
              </button>
              <button type="button" className="ghost-btn" onClick={() => props.onExport(current.id)}>
                Export
              </button>
              <button type="button" className="ghost-btn" onClick={() => fileRef.current?.click()}>
                Import
              </button>
              <button type="button" className="ghost-btn" onClick={() => setConfirmDelete(true)} disabled={props.boards.length < 2} title={props.boards.length < 2 ? 'Keep at least one board' : undefined}>
                Delete
              </button>
            </div>
          )}
          {error && <p className="err-text">{error}</p>}
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e)} />
        </div>
      )}

      {props.user && (
        <form action={signOut} className="account">
          <span className="account-name" title={props.user.email}>
            {props.user.name || props.user.email}
          </span>
          <button type="submit" className="ghost-btn">
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
