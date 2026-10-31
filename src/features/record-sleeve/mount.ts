import { slideProgress } from './model/slide-progress';
import { SLIDE_END_RATIO } from './shared/constants';

export type RecordSleeveHandlers = {
  /** The sleeve button asks to open the cover; the page opens it in the hero. */
  readonly onRevealRequest: () => void;
};

export type RecordSleeveInstance = {
  destroy: () => void;
};

/**
 * Slides the record out of the sleeve as the sleeve scrolls up into view and
 * back in on the way down: writes `--sleeve-out` (0..1) on `root`, CSS moves
 * the record and turns its label (see .sleeve in app.css). With
 * prefers-reduced-motion it does not follow the scroll and CSS keeps the
 * record out. The «Відкрити обкладинку» button works either way.
 */
export function mountRecordSleeve(root: HTMLElement, handlers: RecordSleeveHandlers): RecordSleeveInstance {
  const button = root.querySelector<HTMLButtonElement>('[data-sleeve-reveal]');

  // the button disappears; keep keyboard focus on the sleeve it opened
  const onButtonClick = (): void => {
    if (document.activeElement === button) root.focus({ preventScroll: true });
    handlers.onRevealRequest();
  };
  button?.addEventListener('click', onButtonClick);

  const stopScroll = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? null : followScroll(root);

  return {
    destroy: () => {
      button?.removeEventListener('click', onButtonClick);
      stopScroll?.();
    },
  };
}

function followScroll(root: HTMLElement): () => void {
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

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
