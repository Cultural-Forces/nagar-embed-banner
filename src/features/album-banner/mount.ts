import { getBannerConfig } from './api/get-banner-config';
import { startScratchController } from './controller/scratch-controller';
import { FALLBACK_LABEL, HINT_HIDE_DELAY_MS } from './shared/constants';
import { createBannerCanvas } from './ui/banner-canvas';
import { createBannerFallback } from './ui/banner-fallback';
import { createBannerHint } from './ui/banner-hint';

export type AlbumBannerMode = 'scratch' | 'fallback';

export type AlbumBannerHandlers = {
  readonly onScratchStart: () => void;
  readonly onRevealComplete: () => void;
  readonly onClick: (redirectPath: string) => void;
  readonly onFailure?: (error: Error) => void;
};

export type AlbumBannerInstance = {
  readonly rootElement: HTMLElement;
  readonly mode: AlbumBannerMode;
  destroy: () => void;
};

export async function mountAlbumBanner(
  parent: HTMLElement,
  handlers: AlbumBannerHandlers,
): Promise<AlbumBannerInstance> {
  const config = getBannerConfig();
  const { root, coverCanvas, scratchCanvas } = createBannerCanvas();
  const hint = createBannerHint(config.hintText);
  root.append(hint.element);
  parent.append(root);

  let hintHideTimer: number | null = null;

  try {
    const controller = await startScratchController({
      coverCanvas,
      scratchCanvas,
      config,
      onScratchStart: handlers.onScratchStart,
      onRevealComplete: () => {
        scratchCanvas.classList.add('album-banner__scratch--revealed');
        hint.hide();
        handlers.onRevealComplete();
      },
      onClick: () => handlers.onClick(config.redirectPath),
      onFirstMove: () => {
        if (hintHideTimer !== null) return;
        hintHideTimer = window.setTimeout(() => hint.hide(), HINT_HIDE_DELAY_MS);
      },
    });

    return {
      rootElement: root,
      mode: 'scratch',
      destroy: () => {
        if (hintHideTimer !== null) {
          window.clearTimeout(hintHideTimer);
          hintHideTimer = null;
        }
        controller.destroy();
        root.remove();
      },
    };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error('album-banner init failed');
    handlers.onFailure?.(failure);

    // tear down partial scratch UI before mounting fallback
    coverCanvas.remove();
    scratchCanvas.remove();
    hint.element.remove();
    if (hintHideTimer !== null) {
      window.clearTimeout(hintHideTimer);
      hintHideTimer = null;
    }

    const fallback = createBannerFallback({
      fallbackImageUrl: config.coverUrl,
      redirectPath: config.redirectPath,
      label: FALLBACK_LABEL,
    });
    fallback.root.addEventListener('click', (event) => {
      // onClick opens the URL itself; keep href only for middle-click / a11y
      event.preventDefault();
      handlers.onClick(config.redirectPath);
    });
    root.append(fallback.root);

    return {
      rootElement: root,
      mode: 'fallback',
      destroy: () => {
        root.remove();
      },
    };
  }
}
