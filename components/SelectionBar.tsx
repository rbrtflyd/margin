'use client';

import type { ArrangeOp } from '@/lib/align';
import type { Fill, Item, Route } from '@/lib/types';
import { FILL_ORDER, FILLS, isBox, itemKind } from '@/lib/items';

interface Props {
  items: Item[];
  left: number;
  top: number;
  onPatchAll(patch: Partial<Item>, coalesceKey?: string): void;
  onToggleLock(): void;
  onArrange(op: ArrangeOp): void;
}

function effectiveFill(it: Item): Fill {
  if (it.fill && it.fill !== 'none') return it.fill;
  return itemKind(it) === 'sticky' ? 'amber' : 'white';
}

function sharedFill(items: Item[]): Fill | null {
  if (!items.length) return null;
  const first = effectiveFill(items[0]);
  return items.every((i) => effectiveFill(i) === first) ? first : null;
}

function sharedRoute(items: Item[]): Route | null {
  if (!items.length) return null;
  const first = items[0].route ?? 'straight';
  return items.every((i) => (i.route ?? 'straight') === first) ? first : null;
}

export default function SelectionBar(props: Props) {
  const fillables = props.items.filter((i) => {
    const k = itemKind(i);
    return k === 'sticky' || k === 'shape';
  });
  const routes = props.items.filter((i) => itemKind(i) === 'connector');
  const fill = sharedFill(fillables);
  const route = sharedRoute(routes);
  const allLocked =
    props.items.length > 0 && props.items.every((i) => i.locked);
  if (!fillables.length && !routes.length && !props.items.length) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
      style={{ left: props.left, top: props.top }}
      onPointerDown={(e) => e.stopPropagation()}>
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-stone-100 bg-white/80 p-1 shadow-sm backdrop-blur-md">
        {fillables.length > 0 &&
          FILL_ORDER.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={fill === name}
              className="size-6 rounded-md border-0 ring-offset-1 hover:ring-1 hover:ring-zinc-400 aria-pressed:ring-2 aria-pressed:ring-sky-700"
              style={{ background: FILLS[name].bg }}
              onClick={() => props.onPatchAll({ fill: name }, 'fill')}
            />
          ))}
        {fillables.length > 0 && routes.length > 0 && (
          <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden="true" />
        )}
        {routes.length > 0 && (
          <>
            <button
              type="button"
              className="rounded-lg border-0 bg-transparent px-2 py-1 text-[12.5px] hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100"
              aria-pressed={route === 'straight'}
              onClick={() => props.onPatchAll({ route: 'straight' }, 'route')}>
              Straight
            </button>
            <button
              type="button"
              className="rounded-lg border-0 bg-transparent px-2 py-1 text-[12.5px] hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100"
              aria-pressed={route === 'elbow'}
              onClick={() => props.onPatchAll({ route: 'elbow' }, 'route')}>
              Elbow
            </button>
          </>
        )}
        {props.items.filter(isBox).length >= 2 && (
          <>
            {(fillables.length > 0 || routes.length > 0) && (
              <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden="true" />
            )}
            {(
              [
                ['left', 'Left'],
                ['center', 'Center'],
                ['right', 'Right'],
                ['top', 'Top'],
                ['middle', 'Middle'],
                ['bottom', 'Bottom'],
              ] as const
            ).map(([op, label]) => (
              <button
                key={op}
                type="button"
                title={label}
                aria-label={label}
                className="rounded-lg border-0 bg-transparent px-1.5 py-1 text-[12px] hover:bg-zinc-900/10"
                onClick={() => props.onArrange(op)}>
                {label[0]}
              </button>
            ))}
            <button
              type="button"
              title="Distribute horizontally"
              aria-label="Distribute horizontally"
              className="rounded-lg border-0 bg-transparent px-1.5 py-1 text-[12px] hover:bg-zinc-900/10"
              onClick={() => props.onArrange('distribute-h')}>
              H
            </button>
            <button
              type="button"
              title="Distribute vertically"
              aria-label="Distribute vertically"
              className="rounded-lg border-0 bg-transparent px-1.5 py-1 text-[12px] hover:bg-zinc-900/10"
              onClick={() => props.onArrange('distribute-v')}>
              V
            </button>
            <button
              type="button"
              title="Tidy up"
              aria-label="Tidy up"
              className="rounded-lg border-0 bg-transparent px-1.5 py-1 text-[12px] hover:bg-zinc-900/10"
              onClick={() => props.onArrange('tidy')}>
              Tidy
            </button>
          </>
        )}
        {(fillables.length > 0 ||
          routes.length > 0 ||
          props.items.filter(isBox).length >= 2) && (
          <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden="true" />
        )}
        <button
          type="button"
          className="rounded-lg border-0 bg-transparent px-2 py-1 text-[12.5px] hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100"
          aria-pressed={allLocked}
          aria-label={allLocked ? 'Unlock' : 'Lock'}
          onClick={props.onToggleLock}>
          {allLocked ? 'Unlock' : 'Lock'}
        </button>
      </div>
    </div>
  );
}
