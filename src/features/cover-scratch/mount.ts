import { startScratchController, type ScratchController } from './controller/scratch-controller';
import { startScrollSettle, type ScrollSettle } from './controller/scroll-settle';
import { waitForImage } from './controller/wait-for-image';
import { createDemoStroke } from './model/demo-stroke';
import {
  DEMO_STROKE_DELAY_MS,
  DEMO_STROKE_MS,
  DISSOLVE_DURATION_MS,
  HINT_HIDE_DELAY_MS,
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
 * decoded the <img> with the nagar stays on screen; then a canvas replaces it.
 * If the canvas cannot start, the cover is shown as is (`cover--static`).
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

  // The rest of the nagar crumbles away, then soot settles back on the cover
  // as it scrolls out of view and clears when it comes back.
  const playReveal = (scratch: ScratchController): void => {
    void scratch.dissolve(reducedMotion ? 0 : DISSOLVE_DURATION_MS).then(() => {
      if (reducedMotion || scrollSettle !== null) return;
      scrollSettle = startScrollSettle({ target: refs.stage, onLevel: scratch.setSettleLevel });
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
      scrollSettle?.destroy();
      controller?.destroy();
      canvas?.remove();
    },
  };

  try {
    await Promise.all([waitForImage(refs.image), waitForImage(refs.nagar)]);
    if (revealed) return instance;

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
    root.classList.add('cover--canvas');
    startHint(controller);
  } catch (error) {
    canvas?.remove();
    canvas = null;
    root.classList.add('cover--static');
    handlers.onFailure?.(error instanceof Error ? error : new Error('cover-scratch init failed'));
  }

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
