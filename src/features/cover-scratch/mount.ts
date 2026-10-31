import { startCardTilt, type CardTiltHandle } from './controller/card-tilt';
import { createHaloRenderer, type HaloRenderer } from './controller/halo-renderer';
import { startScratchController, type ScratchController } from './controller/scratch-controller';
import { waitForImageWithRetry } from './controller/wait-for-image';
import { createDemoStroke } from './model/demo-stroke';
import { easeInOutCubic } from './model/easing';
import {
  DEMO_STROKE_DELAY_MS,
  APPEAR_DURATION_MS,
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
  readonly card: HTMLElement;
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
 * loaded a dark blurred placeholder and a loader stay on screen
 * (`cover--loading`); then the nagar gathers on a canvas over it
 * (`cover--ready`), and once it is whole erasing starts (`cover--canvas`).
 * If an image fails to load, the cover stays closed (`cover--nagar-failed`,
 * `cover--image-failed`); if the canvas cannot start, the cover is shown as is
 * (`cover--static`). Once revealed, on desktop the cover glows, and under the
 * mouse grows a little and turns after it (`cover--lifted`).
 */
export async function mountCoverScratch(
  root: HTMLElement,
  handlers: CoverScratchHandlers,
): Promise<CoverScratchInstance> {
  const refs = queryRefs(root);

  let controller: ScratchController | null = null;
  let cardTilt: CardTiltHandle | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let revealed = false;
  let hintHideTimer: number | null = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hideHint = (): void => {
    refs.hint.classList.add('cover__hint--hidden');
  };

  // The clean cover comes forward like a card in the hand: on desktop it
  // glows, and under the mouse grows and turns after it (see .cover__card
  // in app.css).
  const lift = (): void => {
    if (root.classList.contains('cover--lifted')) return;
    root.classList.add('cover--lifted');
    if (!reducedMotion) cardTilt = startCardTilt({ area: root, card: refs.card });
  };

  // The rest of the nagar crumbles away, the soot past its edges with it,
  // and the cover is left clean.
  const playReveal = (scratch: ScratchController): void => {
    const duration = reducedMotion ? 0 : DISSOLVE_DURATION_MS;
    void Promise.all([scratch.dissolve(duration), animateEdge(0, duration)]).then(lift);
  };

  // The soot past the nagar edges before the reveal, on its own canvas around the cover.
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
  // end in a straight line. It grows while the nagar gathers and goes with it
  // on reveal; redrawn on resize to keep it sharp.
  let edgeLevel = 0;
  const drawEdge = (): void => {
    if (revealed) return;
    halo?.draw(edgeLevel);
  };

  let edgeFrame: number | null = null;
  // A new run takes over from one still going (the reveal can come while the
  // soot is still growing), so the two do not fight over the level.
  let edgeDone: (() => void) | null = null;
  const animateEdge = (to: number, durationMs: number): Promise<void> => {
    if (halo === null) return Promise.resolve();
    if (edgeFrame !== null) cancelAnimationFrame(edgeFrame);
    edgeFrame = null;
    edgeDone?.();
    const from = edgeLevel;
    return new Promise((resolve) => {
      edgeDone = resolve;
      const start = performance.now();
      const step = (now: number): void => {
        const t = durationMs > 0 ? Math.min(1, (now - start) / durationMs) : 1;
        edgeLevel = from + (to - from) * easeInOutCubic(t);
        halo?.draw(edgeLevel);
        if (t < 1) {
          edgeFrame = requestAnimationFrame(step);
        } else {
          edgeFrame = null;
          edgeDone = null;
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
    else lift();
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
      cardTilt?.destroy();
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

    const scratch = startScratchController({
      stage: refs.stage,
      canvas,
      nagar: refs.nagar,
      onScratchStart: () => {
        hintHideTimer = window.setTimeout(hideHint, HINT_HIDE_DELAY_MS);
        handlers.onScratchStart();
      },
      onThresholdReached: () => reveal('scratch'),
    });
    controller = scratch;

    // The nagar gathers in blotches over the placeholder, the soot past its
    // edges grows with it. The cover under the canvas switches on only once
    // the nagar is whole, or it would show through the gaps; then the hint.
    const appearMs = reducedMotion ? 0 : APPEAR_DURATION_MS;
    ensureHalo();
    window.addEventListener('resize', drawEdge);
    void Promise.all([scratch.appear(appearMs), animateEdge(EDGE_SOOT_LEVEL, appearMs)]).then(() => {
      root.classList.add('cover--canvas');
      // opened while the nagar was gathering: no hint over the open cover
      if (!revealed) startHint(scratch);
    });
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
    card: find('[data-cover-card]', HTMLElement),
    stage: find('[data-cover-stage]', HTMLElement),
    image: find('[data-cover-image]', HTMLImageElement),
    nagar: find('[data-cover-nagar]', HTMLImageElement),
    overlay: find('[data-cover-overlay]', HTMLElement),
    hint: find('[data-cover-hint]', HTMLElement),
    button: find('[data-cover-reveal]', HTMLButtonElement),
    status: find('[data-cover-status]', HTMLElement),
  };
}
