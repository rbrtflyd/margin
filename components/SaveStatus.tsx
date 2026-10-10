import { Island } from './Island';

export type SaveStatusKind = 'saving' | 'saved' | 'offline';

const labels: Record<SaveStatusKind, string> = {
  saving: 'Saving',
  saved: 'Saved',
  offline: 'Offline',
};

export default function SaveStatus({ status }: { status: SaveStatusKind }) {
  return (
    <Island
      position="top-left"
      className="left-64 px-2.5 py-1.5 text-[12px] font-medium text-zinc-500"
      aria-live="polite">
      {labels[status]}
    </Island>
  );
}
