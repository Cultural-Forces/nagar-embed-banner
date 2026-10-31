import { SETTLE_MAX_LEVEL, SETTLE_SCROLL_RANGE, SETTLE_SMOOTHING_MS } from '../shared/constants';
import { settleLevel } from '../model/settle-level';

export type ScrollSettleDeps = {
  readonly target: HTMLElement;
  readonly onLevel: (level: number) => void;
};

export type ScrollSettle = {
  destroy: () => void;
};

const EPSILON = 0.001;

/**
 * Maps the scroll position of `target` to a soot level. The target level
 * follows scroll exactly; the shown level eases towards it every frame, so a
 * flick of the finger does not make the soot jump. Frames run only while the
 * two differ.
 */
export function startScrollSettle(deps: ScrollSettleDeps): ScrollSettle {
  let current = 0;
  let target = 0;
  let frame: number | null = null;
  let lastTime: number | null = null;

  const measure = (): void => {
    const rect = deps.target.getBoundingClientRect();
    target = settleLevel(rect.top, rect.height, SETTLE_MAX_LEVEL, SETTLE_SCROLL_RANGE);
  };

  const tick = (now: number): void => {
    const dt = lastTime === null ? 16 : now - lastTime;
    lastTime = now;
    current += (target - current) * (1 - Math.exp(-dt / SETTLE_SMOOTHING_MS));
    if (Math.abs(target - current) < EPSILON) current = target;
    deps.onLevel(current);

    if (current === target) {
      frame = null;
      lastTime = null;
    } else {
      frame = requestAnimationFrame(tick);
    }
  };

  const onScroll = (): void => {
    measure();
    if (frame === null && Math.abs(target - current) >= EPSILON) {
      frame = requestAnimationFrame(tick);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  return {
    destroy: () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    },
  };
}
