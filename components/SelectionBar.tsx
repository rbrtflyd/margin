'use client';

import type { Fill, Item, Route } from '@/lib/types';
import { FILL_ORDER, FILLS, itemKind } from '@/lib/items';

interface Props {
  item: Item;
  left: number;
  top: number;
  onFill(fill: Fill): void;
  onRoute(route: Route): void;
}

export default function SelectionBar(props: Props) {
  const kind = itemKind(props.item);
  const showFill = kind === 'sticky' || kind === 'shape';
  const showRoute = kind === 'connector';
  if (!showFill && !showRoute) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
      style={{ left: props.left, top: props.top }}
      onPointerDown={(e) => e.stopPropagation()}>
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-stone-100 bg-white/80 p-1 shadow-sm backdrop-blur-md">
        {showFill &&
          FILL_ORDER.map((fill) => {
            const on = (props.item.fill ?? (kind === 'sticky' ? 'amber' : 'white')) === fill;
            return (
              <button
                key={fill}
                type="button"
                title={fill}
                aria-pressed={on}
                className="size-6 rounded-md border-0 ring-offset-1 hover:ring-1 hover:ring-zinc-400 aria-pressed:ring-2 aria-pressed:ring-sky-700"
                style={{ background: FILLS[fill].bg }}
                onClick={() => props.onFill(fill)}
              />
            );
          })}
        {showRoute && (
          <>
            <button
              type="button"
              className="rounded-lg border-0 bg-transparent px-2 py-1 text-[12.5px] hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100"
              aria-pressed={(props.item.route ?? 'straight') === 'straight'}
              onClick={() => props.onRoute('straight')}>
              Straight
            </button>
            <button
              type="button"
              className="rounded-lg border-0 bg-transparent px-2 py-1 text-[12.5px] hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100"
              aria-pressed={props.item.route === 'elbow'}
              onClick={() => props.onRoute('elbow')}>
              Elbow
            </button>
          </>
        )}
      </div>
    </div>
  );
}
