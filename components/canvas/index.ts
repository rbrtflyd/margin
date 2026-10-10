import type { Drag, InteractionCtx } from './types';
import { movePan, endPan } from './pan';
import { moveMove, endMove } from './move';
import { moveMarquee, endMarquee } from './marquee';
import { movePlace, endPlace } from './place';
import { moveConnect, endConnect } from './connect';
import { moveResize, endResize } from './resize';
import { moveEndpoint, endEndpoint } from './endpoint';
import { moveBend, endBend } from './bend';
import { moveLabel, endLabel } from './label';

export function moveDrag(ctx: InteractionCtx, d: Drag, e: PointerEvent) {
  switch (d.kind) {
    case 'pan':
      return movePan(ctx, d, e);
    case 'move':
      return moveMove(ctx, d, e);
    case 'marquee':
      return moveMarquee(ctx, d, e);
    case 'place':
      return movePlace(ctx, d, e);
    case 'connector':
      return moveConnect(ctx, d, e);
    case 'resize':
      return moveResize(ctx, d, e);
    case 'endpoint':
      return moveEndpoint(ctx, d, e);
    case 'bend':
      return moveBend(ctx, d, e);
    case 'label':
      return moveLabel(ctx, d, e);
  }
}

export function endDrag(ctx: InteractionCtx, d: Drag, e: PointerEvent) {
  switch (d.kind) {
    case 'pan':
      return endPan(ctx);
    case 'move':
      return endMove(ctx, d, e);
    case 'marquee':
      return endMarquee(ctx, d);
    case 'place':
      return endPlace(ctx, d, e);
    case 'connector':
      return endConnect(ctx, d, e);
    case 'resize':
      return endResize(ctx, d, e);
    case 'endpoint':
      return endEndpoint(ctx, d, e);
    case 'bend':
      return endBend(ctx, d, e);
    case 'label':
      return endLabel(ctx, d, e);
  }
}
