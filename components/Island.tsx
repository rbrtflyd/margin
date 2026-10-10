import type { ComponentProps } from 'react';
import { cn } from 'cn';

const positions = {
  'top-left': 'fixed top-[calc(12px+env(safe-area-inset-top,0px))] left-3 z-20',
  'top-right':
    'fixed top-[calc(12px+env(safe-area-inset-top,0px))] right-3 z-20',
  'bottom-center':
    'fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-1/2 z-20 max-w-[calc(100vw-24px)] -translate-x-1/2',
} as const;

type IslandPosition = keyof typeof positions;

export function Island({
  position,
  className,
  as: Tag = 'div',
  ...props
}: ComponentProps<'div'> & {
  position: IslandPosition;
  as?: 'div' | 'nav';
}) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-stone-100 bg-white/80 shadow-sm backdrop-blur-md',
        positions[position],
        className,
      )}
      {...props}
    />
  );
}
