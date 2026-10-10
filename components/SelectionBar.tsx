'use client';

import type { ArrangeOp } from '@/lib/align';
import type {
  Align,
  Arrowhead,
  Fill,
  FontSize,
  Item,
  Route,
  Stroke,
  StrokeStyle,
  StrokeWidth,
} from '@/lib/types';
import { arrowEndOf, arrowStartOf } from '@/lib/connectors';
import { canEmbed } from '@/lib/embeds';
import { FILL_ORDER, FILLS, INK, isBox, itemKind, STICKY_WIDE } from '@/lib/items';
import type { FormatKind } from '@/lib/format';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  items: Item[];
  left: number;
  top: number;
  onPatchAll(patch: Partial<Item>, coalesceKey?: string): void;
  onToggleLock(): void;
  onArrange(op: ArrangeOp): void;
  onFormat(kind: FormatKind): void;
}

function effectiveFill(it: Item): Fill | 'none' {
  if (it.fill) return it.fill;
  return itemKind(it) === 'sticky' ? 'amber' : 'white';
}

function shared<T>(items: Item[], pick: (it: Item) => T): T | null {
  if (!items.length) return null;
  const first = pick(items[0]);
  return items.every((i) => pick(i) === first) ? first : null;
}

function Chip({
  name,
  pressed,
}: {
  name: Fill | 'none' | 'ink' | 'mixed';
  pressed?: boolean;
}) {
  const bg =
    name === 'none' || name === 'mixed'
      ? 'transparent'
      : name === 'ink'
        ? INK
        : FILLS[name].bg;
  return (
    <span
      className={
        'relative block size-6 overflow-hidden rounded-md border border-stone-200 ' +
        (pressed ? 'ring-2 ring-sky-700' : '')
      }
      style={{ background: bg }}>
      {name === 'none' && (
        <span
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top right, transparent calc(50% - 0.6px), #a8a29e 50%, transparent calc(50% + 0.6px))',
          }}
        />
      )}
      {name === 'mixed' && (
        <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#e7e5e4_0_4px,#fff_4px_8px)]" />
      )}
    </span>
  );
}

const STROKE_WIDTHS: StrokeWidth[] = [1, 2, 4];
const STROKE_STYLES: { id: StrokeStyle; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];

export default function SelectionBar(props: Props) {
  const fillables = props.items.filter((i) => {
    const k = itemKind(i);
    return k === 'sticky' || k === 'shape';
  });
  const shapes = props.items.filter((i) => itemKind(i) === 'shape');
  const textables = props.items.filter((i) => {
    const k = itemKind(i);
    return k === 'text' || k === 'sticky' || k === 'shape';
  });
  const routes = props.items.filter((i) => itemKind(i) === 'connector');
  const images = props.items.filter((i) => itemKind(i) === 'image');
  const embeddable = props.items.filter(
    (i) =>
      (itemKind(i) === 'link' || itemKind(i) === 'embed') && canEmbed(i.url),
  );
  const fill = shared(fillables, effectiveFill);
  const stroke = shared(shapes, (i) => i.stroke ?? null);
  const strokeWidth = shared(shapes, (i) => i.strokeWidth ?? null);
  const strokeStyle = shared(shapes, (i) => i.strokeStyle ?? 'solid');
  const textColor = shared(textables, (i) => i.textColor ?? null);
  const route = shared(routes, (i) => (i.route ?? 'straight') as Route);
  const allLocked =
    props.items.length > 0 && props.items.every((i) => i.locked);
  const showNone = shapes.length > 0;
  if (
    !fillables.length &&
    !routes.length &&
    !textables.length &&
    !props.items.length
  )
    return null;

  const pill =
    'rounded-lg border-0 bg-transparent px-2 py-1 text-[12.5px] hover:bg-zinc-900/10 aria-pressed:bg-zinc-900 aria-pressed:text-stone-100';

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
      style={{ left: props.left, top: props.top }}
      onPointerDown={(e) => e.stopPropagation()}>
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-stone-100 bg-white/80 p-1 shadow-sm backdrop-blur-md">
        {fillables.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-1 rounded-lg border-0 bg-transparent px-1.5 py-1 hover:bg-zinc-900/10"
              aria-label="Fill"
              title="Fill">
              <Chip name={fill ?? 'mixed'} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              className="grid w-[168px] min-w-0 grid-cols-4 gap-1 p-1.5">
              {FILL_ORDER.map((name) => (
                <DropdownMenuItem
                  key={name}
                  className="flex size-8 items-center justify-center p-0"
                  aria-label={name}
                  onClick={() => props.onPatchAll({ fill: name }, 'fill')}>
                  <Chip
                    name={name}
                    pressed={fill === name}
                  />
                </DropdownMenuItem>
              ))}
              {showNone && (
                <DropdownMenuItem
                  className="flex size-8 items-center justify-center p-0"
                  aria-label="none"
                  onClick={() => props.onPatchAll({ fill: 'none' }, 'fill')}>
                  <Chip
                    name="none"
                    pressed={fill === 'none'}
                  />
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {shapes.length > 0 && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1 rounded-lg border-0 bg-transparent px-1.5 py-1 text-[12.5px] hover:bg-zinc-900/10"
                aria-label="Stroke color"
                title="Stroke color">
                Stroke
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="grid w-[168px] min-w-0 grid-cols-4 gap-1 p-1.5">
                {FILL_ORDER.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    className="flex size-8 items-center justify-center p-0"
                    aria-label={name}
                    onClick={() =>
                      props.onPatchAll({ stroke: name as Stroke }, 'stroke')
                    }>
                    <Chip
                      name={name}
                      pressed={stroke === name}
                    />
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  className="flex size-8 items-center justify-center p-0"
                  aria-label="ink"
                  onClick={() => props.onPatchAll({ stroke: 'ink' }, 'stroke')}>
                  <Chip
                    name="ink"
                    pressed={stroke === 'ink'}
                  />
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex size-8 items-center justify-center p-0"
                  aria-label="none"
                  onClick={() => props.onPatchAll({ stroke: 'none' }, 'stroke')}>
                  <Chip
                    name="none"
                    pressed={stroke === 'none'}
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={pill}
                aria-label="Stroke width"
                title="Stroke width">
                {strokeWidth ?? 'W'}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="min-w-24">
                {STROKE_WIDTHS.map((n) => (
                  <DropdownMenuItem
                    key={n}
                    aria-label={String(n)}
                    onClick={() =>
                      props.onPatchAll({ strokeWidth: n }, 'stroke')
                    }>
                    {n}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={pill}
                aria-label="Stroke style"
                title="Stroke style">
                {strokeStyle === 'dashed'
                  ? 'Dash'
                  : strokeStyle === 'dotted'
                    ? 'Dot'
                    : 'Line'}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="min-w-28">
                {STROKE_STYLES.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() =>
                      props.onPatchAll({ strokeStyle: s.id }, 'stroke')
                    }>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        {textables.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-1 rounded-lg border-0 bg-transparent px-1.5 py-1 hover:bg-zinc-900/10"
              aria-label="Text color"
              title="Text color">
              <Chip name={textColor ?? 'mixed'} />
              <span className="text-[12.5px]">A</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              className="grid w-[168px] min-w-0 grid-cols-4 gap-1 p-1.5">
              {FILL_ORDER.map((name) => (
                <DropdownMenuItem
                  key={name}
                  className="flex size-8 items-center justify-center p-0"
                  aria-label={name}
                  onClick={() =>
                    props.onPatchAll({ textColor: name }, 'textColor')
                  }>
                  <Chip
                    name={name}
                    pressed={textColor === name}
                  />
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                className="flex size-8 items-center justify-center p-0"
                aria-label="ink"
                onClick={() =>
                  props.onPatchAll({ textColor: 'ink' }, 'textColor')
                }>
                <Chip
                  name="ink"
                  pressed={textColor === 'ink'}
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {fillables.length > 0 && routes.length > 0 && (
          <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden="true" />
        )}
        {routes.length > 0 && (
          <>
            {(['straight', 'elbow', 'curved'] as Route[]).map((r) => (
              <button
                key={r}
                type="button"
                className={pill}
                aria-pressed={route === r}
                onClick={() => props.onPatchAll({ route: r }, 'route')}>
                {r === 'straight' ? 'Straight' : r === 'elbow' ? 'Elbow' : 'Curve'}
              </button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={pill}
                aria-label="Arrows"
                title="Arrows">
                Arrows
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="min-w-36 p-1">
                {(
                  [
                    ['none', 'None'],
                    ['start', 'Start'],
                    ['end', 'End'],
                    ['both', 'Both'],
                  ] as const
                ).map(([id, label]) => (
                  <DropdownMenuItem
                    key={id}
                    aria-pressed={
                      shared(routes, (i) => {
                        const s = arrowStartOf(i) !== 'none';
                        const e = arrowEndOf(i) !== 'none';
                        if (s && e) return 'both';
                        if (s) return 'start';
                        if (e) return 'end';
                        return 'none';
                      }) === id
                    }
                    onClick={() => {
                      const style =
                        shared(routes, (i) => {
                          const s = arrowStartOf(i);
                          const e = arrowEndOf(i);
                          if (s !== 'none') return s;
                          if (e !== 'none') return e;
                          return 'arrow' as Arrowhead;
                        }) ?? 'arrow';
                      const none = 'none' as Arrowhead;
                      const patch =
                        id === 'none'
                          ? { arrowStart: none, arrowEnd: none }
                          : id === 'start'
                            ? { arrowStart: style, arrowEnd: none }
                            : id === 'end'
                              ? { arrowStart: none, arrowEnd: style }
                              : { arrowStart: style, arrowEnd: style };
                      props.onPatchAll(patch, 'arrow');
                    }}>
                    {label}
                  </DropdownMenuItem>
                ))}
                {(['arrow', 'triangle', 'circle'] as Arrowhead[]).map((st) => (
                  <DropdownMenuItem
                    key={st}
                    aria-pressed={
                      shared(routes, (i) => {
                        const s = arrowStartOf(i);
                        const e = arrowEndOf(i);
                        if (s !== 'none') return s;
                        if (e !== 'none') return e;
                        return 'arrow';
                      }) === st
                    }
                    onClick={() => {
                      const ends =
                        shared(routes, (i) => {
                          const s = arrowStartOf(i) !== 'none';
                          const e = arrowEndOf(i) !== 'none';
                          if (s && e) return 'both';
                          if (s) return 'start';
                          if (e) return 'end';
                          return 'end';
                        }) ?? 'end';
                      const patch =
                        ends === 'start'
                          ? { arrowStart: st, arrowEnd: 'none' as Arrowhead }
                          : ends === 'both'
                            ? { arrowStart: st, arrowEnd: st }
                            : { arrowStart: 'none' as Arrowhead, arrowEnd: st };
                      props.onPatchAll(patch, 'arrow');
                    }}>
                    {st === 'arrow' ? 'Arrow' : st === 'triangle' ? 'Triangle' : 'Circle'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        {props.items.filter(isBox).length >= 2 && (
          <>
            {(fillables.length > 0 ||
              routes.length > 0 ||
              textables.length > 0) && (
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
        {textables.length > 0 && (
          <>
            <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden="true" />
            {(['s', 'm', 'l', 'xl'] as FontSize[]).map((size) => (
              <button
                key={size}
                type="button"
                title={size.toUpperCase()}
                aria-label={'Font ' + size.toUpperCase()}
                aria-pressed={
                  shared(textables, (i) => i.fontSize ?? 'm') === size
                }
                className={pill}
                onClick={() => props.onPatchAll({ fontSize: size }, 'font')}>
                {size.toUpperCase()}
              </button>
            ))}
            {(['left', 'center', 'right'] as Align[]).map((al, i) => (
              <button
                key={al}
                type="button"
                title={al}
                aria-label={al}
                aria-pressed={
                  shared(textables, (it) => it.align ?? (itemKind(it) === 'shape' ? 'center' : 'left')) ===
                  al
                }
                className={pill}
                onClick={() => props.onPatchAll({ align: al }, 'align')}>
                {['L', 'C', 'R'][i]}
              </button>
            ))}
            <button
              type="button"
              className={pill}
              aria-label="Bold"
              title="Bold"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => props.onFormat('bold')}>
              B
            </button>
            <button
              type="button"
              className={pill}
              aria-label="Italic"
              title="Italic"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => props.onFormat('italic')}>
              I
            </button>
            <button
              type="button"
              className={pill}
              aria-label="Strikethrough"
              title="Strikethrough"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => props.onFormat('strike')}>
              S
            </button>
            <button
              type="button"
              className={pill}
              aria-label="Link"
              title="Link"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => props.onFormat('link')}>
              Link
            </button>
          </>
        )}
        {embeddable.length > 0 &&
          embeddable.length === props.items.length && (
            <>
              <button
                type="button"
                className={pill}
                aria-pressed={embeddable.every((i) => itemKind(i) === 'link')}
                onClick={() => props.onPatchAll({ kind: 'link' }, 'embed')}>
                Card
              </button>
              <button
                type="button"
                className={pill}
                aria-pressed={embeddable.every((i) => itemKind(i) === 'embed')}
                onClick={() => props.onPatchAll({ kind: 'embed' }, 'embed')}>
                Embed
              </button>
            </>
          )}
        {images.length === 1 && (
          <input
            type="text"
            value={images[0].caption ?? ''}
            placeholder="Caption"
            aria-label="Caption"
            className="w-36 rounded-lg border-0 bg-transparent px-2 py-1 text-[12.5px] outline-none placeholder:text-zinc-400"
            onChange={(e) =>
              props.onPatchAll(
                { caption: e.target.value || undefined },
                'caption',
              )
            }
          />
        )}
        {props.items.some((i) => itemKind(i) === 'sticky') && (
          <button
            type="button"
            className={pill}
            aria-pressed={
              shared(
                props.items.filter((i) => itemKind(i) === 'sticky'),
                (i) => i.w ?? 160,
              ) === STICKY_WIDE
            }
            aria-label="Wide"
            title="Wide sticky"
            onClick={() => props.onPatchAll({ w: STICKY_WIDE })}>
            Wide
          </button>
        )}
        {(fillables.length > 0 ||
          routes.length > 0 ||
          textables.length > 0 ||
          props.items.filter(isBox).length >= 2) && (
          <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden="true" />
        )}
        <button
          type="button"
          className={pill}
          aria-pressed={allLocked}
          aria-label={allLocked ? 'Unlock' : 'Lock'}
          onClick={props.onToggleLock}>
          {allLocked ? 'Unlock' : 'Lock'}
        </button>
      </div>
    </div>
  );
}
