import type { ShapeKind } from './types';

export type ShapePath = { d: string };

export const SHAPE_KINDS: ShapeKind[] = [
  'rect',
  'ellipse',
  'diamond',
  'triangle',
  'roundRect',
  'parallelogram',
  'cylinder',
  'document',
  'hexagon',
  'star',
  'chevron',
  'speech',
];

function n(v: number): number {
  return Math.round(v * 100) / 100;
}

function roundRect(w: number, h: number, rx: number): string {
  const r = Math.min(rx, w / 2, h / 2);
  return `M ${n(r)},0 H ${n(w - r)} Q ${n(w)},0 ${n(w)},${n(r)} V ${n(h - r)} Q ${n(w)},${n(h)} ${n(w - r)},${n(h)} H ${n(r)} Q 0,${n(h)} 0,${n(h - r)} V ${n(r)} Q 0,0 ${n(r)},0 Z`;
}

function ellipse(w: number, h: number): string {
  const cx = w / 2;
  const rx = w / 2;
  const ry = h / 2;
  return `M ${n(cx)},0 A ${n(rx)} ${n(ry)} 0 1 1 ${n(cx)},${n(h)} A ${n(rx)} ${n(ry)} 0 1 1 ${n(cx)},0 Z`;
}

export function shapePaths(
  kind: ShapeKind | undefined,
  w: number,
  h: number,
): ShapePath[] {
  const ww = Math.max(1, w);
  const hh = Math.max(1, h);
  switch (kind ?? 'rect') {
    case 'rect':
      return [{ d: `M 0,0 H ${n(ww)} V ${n(hh)} H 0 Z` }];
    case 'roundRect':
      return [{ d: roundRect(ww, hh, Math.min(24, ww / 4, hh / 4)) }];
    case 'ellipse':
      return [{ d: ellipse(ww, hh) }];
    case 'diamond':
      return [
        {
          d: `M ${n(ww / 2)},0 L ${n(ww)},${n(hh / 2)} L ${n(ww / 2)},${n(hh)} L 0,${n(hh / 2)} Z`,
        },
      ];
    case 'triangle':
      return [
        { d: `M ${n(ww / 2)},0 L ${n(ww)},${n(hh)} L 0,${n(hh)} Z` },
      ];
    case 'parallelogram': {
      const s = ww * 0.2;
      return [
        {
          d: `M ${n(s)},0 L ${n(ww)},0 L ${n(ww - s)},${n(hh)} L 0,${n(hh)} Z`,
        },
      ];
    }
    case 'hexagon': {
      const x = ww * 0.22;
      return [
        {
          d: `M ${n(x)},0 L ${n(ww - x)},0 L ${n(ww)},${n(hh / 2)} L ${n(ww - x)},${n(hh)} L ${n(x)},${n(hh)} L 0,${n(hh / 2)} Z`,
        },
      ];
    }
    case 'star': {
      const cx = ww / 2;
      const cy = hh / 2;
      const ro = Math.min(ww, hh) / 2;
      const ri = ro * 0.4;
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? ro : ri;
        pts.push(`${n(cx + rad * Math.cos(a))},${n(cy + rad * Math.sin(a))}`);
      }
      return [{ d: `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z` }];
    }
    case 'chevron': {
      const t = ww * 0.28;
      return [
        {
          d: `M 0,0 L ${n(ww - t)},0 L ${n(ww)},${n(hh / 2)} L ${n(ww - t)},${n(hh)} L 0,${n(hh)} L ${n(t)},${n(hh / 2)} Z`,
        },
      ];
    }
    case 'cylinder': {
      const ry = Math.min(hh * 0.18, hh / 4);
      const rx = ww / 2;
      const top = `M 0,${n(ry)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(ww)},${n(ry)} A ${n(rx)} ${n(ry)} 0 0 1 0,${n(ry)} Z`;
      const body = `M 0,${n(ry)} L 0,${n(hh - ry)} A ${n(rx)} ${n(ry)} 0 0 0 ${n(ww)},${n(hh - ry)} L ${n(ww)},${n(ry)} A ${n(rx)} ${n(ry)} 0 0 1 0,${n(ry)} Z`;
      return [{ d: body }, { d: top }];
    }
    case 'document': {
      const wave = Math.min(16, hh * 0.14);
      return [
        {
          d: `M 0,0 H ${n(ww)} V ${n(hh - wave)} Q ${n(ww * 0.75)},${n(hh + wave * 0.35)} ${n(ww / 2)},${n(hh - wave)} Q ${n(ww * 0.25)},${n(hh - wave * 2.3)} 0,${n(hh - wave)} Z`,
        },
      ];
    }
    case 'speech': {
      const tail = Math.min(18, ww * 0.2, hh * 0.2);
      const boxH = hh - tail;
      const rx = Math.min(12, ww / 5, boxH / 5);
      const body = roundRect(ww, boxH, rx);
      const tip = `M ${n(ww * 0.18)},${n(boxH)} L ${n(ww * 0.08)},${n(hh)} L ${n(ww * 0.34)},${n(boxH)} Z`;
      return [{ d: `${body} ${tip}` }];
    }
  }
}

/** Extra CSS padding so label text sits inside the path. */
export function shapePad(kind: ShapeKind | undefined): string {
  switch (kind ?? 'rect') {
    case 'triangle':
      return '22% 16% 10%';
    case 'diamond':
    case 'star':
      return '20% 22%';
    case 'speech':
      return '12px 14px 22%';
    case 'cylinder':
      return '22% 14px 14%';
    case 'chevron':
      return '12px 24% 12px 18%';
    case 'hexagon':
    case 'parallelogram':
      return '12px 20%';
    default:
      return '12px 16px';
  }
}
