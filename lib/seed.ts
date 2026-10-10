import type { Item } from './types';
import { STICKY_SIZE } from './items';
import { nowISO, uid } from './store';

const COLS = 50;
const GAP = 240;
const BAND = 200;

export function seedItems(
  count = 2000,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): Item[] {
  const t = nowISO();
  const rowsPerBand = BAND / COLS;
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    if (i % BAND === 0) {
      items.push({
        id: uid('sec_'),
        x: origin.x,
        y: origin.y + Math.floor(i / COLS) * GAP,
        w: (COLS - 1) * GAP + STICKY_SIZE,
        h: (rowsPerBand - 1) * GAP + STICKY_SIZE,
        text: 'Section ' + (i / BAND + 1),
        by: 'me',
        kind: 'section',
        createdAt: t,
        editedAt: t,
      });
      continue;
    }
    items.push({
      id: uid('s_'),
      x: origin.x + (i % COLS) * GAP,
      y: origin.y + Math.floor(i / COLS) * GAP,
      w: STICKY_SIZE,
      h: STICKY_SIZE,
      text: 'Note ' + i,
      by: 'me',
      kind: 'sticky',
      createdAt: t,
      editedAt: t,
    });
  }
  return items;
}
