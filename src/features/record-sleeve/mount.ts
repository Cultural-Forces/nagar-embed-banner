import { slideEndFraction, slideProgress } from './model/slide-progress';
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
 * back in on the way down (see .sleeve in app.css). Where CSS can tie an
 * animation to scrolling, the browser runs it and JS only places the end of
 * the run; elsewhere JS writes `--sleeve-out` (0..1) on every scroll frame.
 * With prefers-reduced-motion it does neither and CSS keeps the record out.
 * The «Відкрити обкладинку» button works either way.
 */
export function mountRecordSleeve(root: HTMLElement, handlers: RecordSleeveHandlers): RecordSleeveInstance {
  const button = root.querySelector<HTMLButtonElement>('[data-sleeve-reveal]');

  // the button disappears; keep keyboard focus on the sleeve it opened
  const onButtonClick = (): void => {
    if (document.activeElement === button) root.focus({ preventScroll: true });
    handlers.onRevealRequest();
  };
  button?.addEventListener('click', onButtonClick);

  let stopSliding: (() => void) | null = null;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stopSliding = CSS.supports('animation-timeline: view()') ? placeRunEnd(root) : followScroll(root);
  }

  return {
    destroy: () => {
      button?.removeEventListener('click', onButtonClick);
      stopSliding?.();
    },
  };
}

/** Where the sleeve sits on the page; read only when the layout changes, never while scrolling. */
type SleeveMetrics = {
  readonly top: number;
  readonly height: number;
  readonly viewportHeight: number;
  /** The sleeve top at the furthest scroll of the page. */
  readonly highestTop: number;
};

function measure(root: HTMLElement): SleeveMetrics {
  const rect = root.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return { top, height: rect.height, viewportHeight: window.innerHeight, highestTop: top - maxScroll };
}

/** Calls `onChange` when the window or anything in the page changes size. */
function watchLayout(onChange: () => void): () => void {
  const observer = new ResizeObserver(onChange);
  observer.observe(document.documentElement);
  window.addEventListener('resize', onChange);
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', onChange);
  };
}

// The browser moves the record on the scroll timeline (app.css); this only
// says where the run ends, and drops the timeline when the page cannot bring
// the sleeve up, so the record stays out.
function placeRunEnd(root: HTMLElement): () => void {
  const update = (): void => {
    const m = measure(root);
    const end = slideEndFraction(m.height, m.viewportHeight, SLIDE_END_RATIO, m.highestTop);
    if (end === null) {
      delete root.dataset.sleeveTimeline;
      return;
    }
    root.style.setProperty('--sleeve-end', `${(end * 100).toFixed(2)}%`);
    root.dataset.sleeveTimeline = '';
  };

  const stopWatching = watchLayout(update);
  update();
  return stopWatching;
}

function followScroll(root: HTMLElement): () => void {
  let frame: number | null = null;
  let metrics = measure(root);

  const update = (): void => {
    frame = null;
    const { top, height, viewportHeight, highestTop } = metrics;
    const progress = slideProgress(top - window.scrollY, height, viewportHeight, SLIDE_END_RATIO, highestTop);
    root.style.setProperty('--sleeve-out', progress.toFixed(3));
  };

  const onScroll = (): void => {
    if (frame === null) frame = requestAnimationFrame(update);
  };

  const stopWatching = watchLayout(() => {
    metrics = measure(root);
    onScroll();
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  update();

  return () => {
    stopWatching();
    window.removeEventListener('scroll', onScroll);
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
