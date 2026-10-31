import { pointerOffset, tiltForPointer } from '../model/card-tilt';
import { TILT_MAX_DEG, TILT_MEDIA } from '../shared/constants';

export type CardTiltDeps = {
  /** Untransformed box the pointer is measured against, so the turning card does not move it. */
  readonly area: HTMLElement;
  /** Gets `--tilt-x`, `--tilt-y`, `--glare-x`, `--glare-y`, `--pointer-x`, `--pointer-y` and `data-tilt-live`. */
  readonly card: HTMLElement;
};

export type CardTiltHandle = {
  destroy: () => void;
};

/**
 * Turns the revealed cover after the mouse like a card held in the hand, with
 * a glare where the pointer is and the glow behind it shifting after the
 * pointer. CSS draws it (see .cover__card in app.css);
 * here only the variables change. Touch is ignored: on a phone the cover
 * scrolls like any image.
 */
export function startCardTilt(deps: CardTiltDeps): CardTiltHandle {
  const { area, card } = deps;
  const desktop = window.matchMedia(TILT_MEDIA);

  const onMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || !desktop.matches) return;
    const rect = area.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const tilt = tiltForPointer(x, y, TILT_MAX_DEG);
    const offset = pointerOffset(x, y);
    card.style.setProperty('--tilt-x', `${tilt.rotateX.toFixed(2)}deg`);
    card.style.setProperty('--tilt-y', `${tilt.rotateY.toFixed(2)}deg`);
    card.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
    card.style.setProperty('--pointer-x', offset.x.toFixed(3));
    card.style.setProperty('--pointer-y', offset.y.toFixed(3));
    card.dataset.tiltLive = '';
  };

  const onLeave = (): void => {
    delete card.dataset.tiltLive;
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    // the glow goes back to where CSS keeps it at rest
    card.style.removeProperty('--pointer-x');
    card.style.removeProperty('--pointer-y');
  };

  area.addEventListener('pointermove', onMove);
  area.addEventListener('pointerleave', onLeave);

  return {
    destroy: () => {
      area.removeEventListener('pointermove', onMove);
      area.removeEventListener('pointerleave', onLeave);
      onLeave();
    },
  };
}
