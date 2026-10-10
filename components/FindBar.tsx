'use client';

import { useEffect, type RefObject } from 'react';
import { Island } from './Island';

interface Props {
  query: string;
  index: number;
  total: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onQuery(q: string): void;
  onPrev(): void;
  onNext(): void;
  onClose(): void;
}

export default function FindBar(props: Props) {
  useEffect(() => {
    props.inputRef.current?.focus();
    props.inputRef.current?.select();
  }, [props.inputRef]);

  const status =
    props.total === 0
      ? 'No matches'
      : props.index + 1 + ' of ' + props.total;

  return (
    <Island
      position="top-center"
      className="flex items-center gap-1 p-1"
      role="search">
      <input
        ref={props.inputRef}
        value={props.query}
        onChange={(e) => props.onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            props.onClose();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) props.onPrev();
            else props.onNext();
          }
        }}
        placeholder="Find"
        aria-label="Find"
        className="w-44 border-0 bg-transparent px-2.5 py-1.5 text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400"
      />
      <span className="min-w-[4.5rem] px-1 font-mono text-[11px] text-zinc-500 tabular-nums">
        {status}
      </span>
      <button
        type="button"
        className="inline-flex cursor-pointer items-center rounded-lg border-0 bg-transparent px-2 py-1.5 text-[13.5px] text-zinc-600 hover:bg-zinc-900/10 disabled:opacity-40"
        disabled={props.total === 0}
        aria-label="Previous match"
        onClick={props.onPrev}>
        Prev
      </button>
      <button
        type="button"
        className="inline-flex cursor-pointer items-center rounded-lg border-0 bg-transparent px-2 py-1.5 text-[13.5px] text-zinc-600 hover:bg-zinc-900/10 disabled:opacity-40"
        disabled={props.total === 0}
        aria-label="Next match"
        onClick={props.onNext}>
        Next
      </button>
    </Island>
  );
}
