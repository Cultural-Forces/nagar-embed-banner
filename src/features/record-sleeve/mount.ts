import { slideProgress } from './model/slide-progress';
import { SLIDE_END_RATIO } from './shared/constants';

export type RecordSleeveInstance = {
  destroy: () => void;
};

/**
 * Slides the record out of the sleeve as the sleeve scrolls up into view and
 * back in on the way down: writes `--sleeve-out` (0..1) on `root`, CSS moves
 * the record and turns its label (see .sleeve in app.css). With
 * prefers-reduced-motion it does nothing and CSS keeps the record half out.
 */
export function mountRecordSleeve(root: HTMLElement): RecordSleeveInstance {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { destroy: () => undefined };
  }

  let frame: number | null = null;

  const update = (): void => {
    frame = null;
    const rect = root.getBoundingClientRect();
    const scroller = document.documentElement;
    const scrollLeft = Math.max(0, scroller.scrollHeight - window.innerHeight - window.scrollY);
    const progress = slideProgress(
      rect.top,
      rect.height,
      window.innerHeight,
      SLIDE_END_RATIO,
      rect.top - scrollLeft,
    );
    root.style.setProperty('--sleeve-out', progress.toFixed(3));
  };

  const onScroll = (): void => {
    if (frame === null) frame = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();

  return {
    destroy: () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    },
  };
}
