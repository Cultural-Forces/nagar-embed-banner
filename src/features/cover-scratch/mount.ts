import { startScratchController, type ScratchController } from './controller/scratch-controller';
import { waitForImage } from './controller/wait-for-image';
import { HINT_HIDE_DELAY_MS, REVEAL_STATUS_TEXT } from './shared/constants';
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
  let canvas: HTMLCanvasElement | null = null;
  let revealed = false;
  let hintHideTimer: number | null = null;

  const hideHint = (): void => {
    refs.hint.classList.add('cover__hint--hidden');
  };

  const reveal = (method: RevealMethod): void => {
    if (revealed) return;
    revealed = true;
    controller?.disable();
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

  const instance: CoverScratchInstance = {
    reveal,
    destroy: () => {
      if (hintHideTimer !== null) window.clearTimeout(hintHideTimer);
      refs.button.removeEventListener('click', onButtonClick);
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
    refs.stage.insertBefore(canvas, refs.hint);

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
    hint: find('[data-cover-hint]', HTMLElement),
    button: find('[data-cover-reveal]', HTMLButtonElement),
    status: find('[data-cover-status]', HTMLElement),
  };
}
