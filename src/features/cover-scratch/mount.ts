import { createHaloRenderer, type HaloRenderer } from './controller/halo-renderer';
import { startScratchController, type ScratchController } from './controller/scratch-controller';
import { startScrollSettle, type ScrollSettle } from './controller/scroll-settle';
import { waitForImageWithRetry } from './controller/wait-for-image';
import { createDemoStroke } from './model/demo-stroke';
import { easeInOutCubic } from './model/settle-level';
import {
  DEMO_STROKE_DELAY_MS,
  DEMO_STROKE_MS,
  DISSOLVE_DURATION_MS,
  EDGE_SOOT_LEVEL,
  HINT_HIDE_DELAY_MS,
  IMAGE_RETRY_DELAY_MS,
  REVEAL_STATUS_TEXT,
} from './shared/constants';
import type { RevealMethod } from './shared/types';

export type CoverScratchHandlers = {
  readonly onScratchStart: () => void;
  readonly onReveal: (method: RevealMethod) => void;
  readonly onFailure?: (error: Error) => void;
};

export type CoverScratchInstance = {
  reveal: (method: RevealMethod) => void;
  destroy: () => void;
};

type CoverRefs = {
  readonly stage: HTMLElement;
  readonly image: HTMLImageElement;
  readonly nagar: HTMLImageElement;
  readonly overlay: HTMLElement;
  readonly hint: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly status: HTMLElement;
};

/**
 * Enhances the static cover markup from index.html. Until the images are
 * loaded a blurred placeholder and a loader stay on screen (`cover--loading`);
 * then a canvas with the nagar fades in (`cover--ready`).
 * If an image fails to load, the cover stays closed (`cover--nagar-failed`,
 * `cover--image-failed`); if the canvas cannot start, the cover is shown as is
 * (`cover--static`).
 */
export async function mountCoverScratch(
  root: HTMLElement,
  handlers: CoverScratchHandlers,
): Promise<CoverScratchInstance> {
  const refs = queryRefs(root);

  let controller: ScratchController | null = null;
  let scrollSettle: ScrollSettle | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let revealed = false;
  let hintHideTimer: number | null = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hideHint = (): void => {
    refs.hint.classList.add('cover__hint--hidden');
  };

  // The rest of the nagar crumbles away, the soot past its edges with it,
  // then soot settles back on the cover as it scrolls out of view and clears
  // when it comes back. Around the cover it spills onto the page, so the
  // cover edges do not cut off sharply.
  const playReveal = (scratch: ScratchController): void => {
    const duration = reducedMotion ? 0 : DISSOLVE_DURATION_MS;
    void Promise.all([scratch.dissolve(duration), fadeEdge(duration)]).then(() => {
      if (reducedMotion || scrollSettle !== null) return;
      const settleHalo = ensureHalo();
      scrollSettle = startScrollSettle({
        target: refs.stage,
        onLevel: (amount) => settleHalo?.draw(amount),
      });
    });
  };

  // One soot halo for both the ragged edge before the reveal and the soot
  // that settles back after it, so the same tongues grow on scroll.
  let haloCanvas: HTMLCanvasElement | null = null;
  let halo: HaloRenderer | null = null;
  let haloFailed = false;
  const ensureHalo = (): HaloRenderer | null => {
    if (halo !== null || haloFailed) return halo;
    haloCanvas = document.createElement('canvas');
    haloCanvas.className = 'cover__halo';
    haloCanvas.setAttribute('aria-hidden', 'true');
    refs.stage.after(haloCanvas);
    try {
      halo = createHaloRenderer({ stage: refs.stage, canvas: haloCanvas, nagar: refs.nagar });
    } catch {
      // the cover keeps straight edges and stays clean after the reveal
      haloFailed = true;
      haloCanvas.remove();
      haloCanvas = null;
    }
    return halo;
  };

  // Before the reveal soot lies past the nagar edges, so the square does not
  // end in a straight line. Redrawn on resize to keep it sharp.
  const drawEdge = (): void => {
    if (revealed) return;
    ensureHalo()?.draw(EDGE_SOOT_LEVEL, true);
  };

  let edgeFrame: number | null = null;
  const fadeEdge = (durationMs: number): Promise<void> => {
    if (halo === null) return Promise.resolve();
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number): void => {
        const t = durationMs > 0 ? Math.min(1, (now - start) / durationMs) : 1;
        halo?.draw(EDGE_SOOT_LEVEL * (1 - easeInOutCubic(t)), true);
        if (t < 1) {
          edgeFrame = requestAnimationFrame(step);
        } else {
          edgeFrame = null;
          resolve();
        }
      };
      step(start);
    });
  };

  const reveal = (method: RevealMethod): void => {
    if (revealed) return;
    revealed = true;
    if (controller !== null) playReveal(controller);
    hideHint();

    // the button disappears; keep keyboard focus near what it revealed
    if (document.activeElement === refs.button) {
      refs.stage.focus({ preventScroll: true });
    }
    root.classList.add('cover--revealed');
    refs.status.textContent = REVEAL_STATUS_TEXT;
    handlers.onReveal(method);
  };

  const onButtonClick = (): void => reveal('button');
  refs.button.addEventListener('click', onButtonClick);

  // TEMP: `data-hint` picks one of the hint variants being compared
  // (text-gesture by default, text, gesture, cutout).
  let demoTimer: number | null = null;
  const startHint = (scratch: ScratchController): void => {
    const variant = root.dataset.hint ?? 'text-gesture';

    if (variant === 'cutout') {
      void cutHintIntoSoot(scratch);
    }
    if ((variant === 'gesture' || variant === 'text-gesture') && !reducedMotion) {
      demoTimer = window.setTimeout(() => {
        scratch.playDemoStroke(createDemoStroke(48), DEMO_STROKE_MS);
      }, DEMO_STROKE_DELAY_MS);
    }
  };

  // The hint text stays in the layout (hidden), so its box tells where and
  // how big to write it into the soot.
  const cutHintIntoSoot = async (scratch: ScratchController): Promise<void> => {
    const style = getComputedStyle(refs.hint);
    await document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
    const stage = refs.stage.getBoundingClientRect();
    const hint = refs.hint.getBoundingClientRect();
    if (stage.width === 0) return;

    scratch.cutText(
      (refs.hint.textContent ?? '').toLocaleUpperCase('uk'),
      { family: style.fontFamily, weight: style.fontWeight, sizeRatio: parseFloat(style.fontSize) / stage.width },
      {
        x: (hint.left + hint.width / 2 - stage.left) / stage.width,
        y: (hint.top + hint.height / 2 - stage.top) / stage.height,
      },
    );
  };

  const instance: CoverScratchInstance = {
    reveal,
    destroy: () => {
      if (hintHideTimer !== null) window.clearTimeout(hintHideTimer);
      if (demoTimer !== null) window.clearTimeout(demoTimer);
      refs.button.removeEventListener('click', onButtonClick);
      window.removeEventListener('resize', drawEdge);
      if (edgeFrame !== null) cancelAnimationFrame(edgeFrame);
      scrollSettle?.destroy();
      haloCanvas?.remove();
      controller?.destroy();
      canvas?.remove();
    },
  };

  // While the images load the loader shows and the hint waits (see app.css).
  // `cover--loading` is set by an inline script in index.html, so the loader
  // does not wait for this module; here it only ends.
  const finishLoading = (): void => {
    root.classList.remove('cover--loading');
    root.classList.add('cover--ready');
    root.removeAttribute('aria-busy');
  };

  // A failed image must not open the cover by itself: without the nagar the
  // placeholder soot and the button stay, without the cover the soot stays.
  const [imageLoad, nagarLoad] = await Promise.allSettled([
    waitForImageWithRetry(refs.image, IMAGE_RETRY_DELAY_MS),
    waitForImageWithRetry(refs.nagar, IMAGE_RETRY_DELAY_MS),
  ]);
  if (imageLoad.status === 'rejected') root.classList.add('cover--image-failed');
  if (nagarLoad.status === 'rejected') root.classList.add('cover--nagar-failed');
  const loadFailure = [imageLoad, nagarLoad].find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (loadFailure !== undefined) {
    const { reason } = loadFailure;
    finishLoading();
    handlers.onFailure?.(reason instanceof Error ? reason : new Error('cover-scratch image load failed'));
    return instance;
  }
  if (revealed) {
    finishLoading();
    return instance;
  }

  try {
    canvas = document.createElement('canvas');
    canvas.className = 'cover__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    refs.stage.insertBefore(canvas, refs.overlay);

    controller = startScratchController({
      stage: refs.stage,
      canvas,
      nagar: refs.nagar,
      onScratchStart: () => {
        hintHideTimer = window.setTimeout(hideHint, HINT_HIDE_DELAY_MS);
        handlers.onScratchStart();
      },
      onThresholdReached: () => reveal('scratch'),
    });
    // The canvas fades in over the placeholder (app.css). The cover under it
    // stays hidden until the canvas is opaque, or it would show through.
    // Browsers without getAnimations (iOS 13.0) show the cover at once.
    const fadeIn = 'getAnimations' in canvas ? canvas.getAnimations() : [];
    void Promise.all(fadeIn.map((animation) => animation.finished)).then(
      () => root.classList.add('cover--canvas'),
      () => undefined,
    );
    startHint(controller);
    drawEdge();
    window.addEventListener('resize', drawEdge);
  } catch (error) {
    canvas?.remove();
    canvas = null;
    root.classList.add('cover--static');
    handlers.onFailure?.(error instanceof Error ? error : new Error('cover-scratch init failed'));
  }
  finishLoading();

  return instance;
}

function queryRefs(root: HTMLElement): CoverRefs {
  const find = <T extends Element>(selector: string, type: { new (): T }): T => {
    const element = root.querySelector(selector);
    if (!(element instanceof type)) {
      throw new Error(`cover-scratch: ${selector} not found`);
    }
    return element;
  };

  return {
    stage: find('[data-cover-stage]', HTMLElement),
    image: find('[data-cover-image]', HTMLImageElement),
    nagar: find('[data-cover-nagar]', HTMLImageElement),
    overlay: find('[data-cover-overlay]', HTMLElement),
    hint: find('[data-cover-hint]', HTMLElement),
    button: find('[data-cover-reveal]', HTMLButtonElement),
    status: find('[data-cover-status]', HTMLElement),
  };
}
