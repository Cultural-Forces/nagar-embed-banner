import { env } from '../shared/config/env';
import { loadGa } from '../shared/lib/analytics/load-ga';
import { sendGaEvent } from '../shared/lib/analytics/send-ga-event';
import { openExternalUrl } from '../shared/lib/dom/open-external-url';
import { EVENT_NAMES, mountAlbumBanner } from '../features/album-banner';

export async function renderEmbedAlbumBannerPage(root: HTMLElement): Promise<void> {
  loadGa(env.GA4_ID);

  try {
    const banner = await mountAlbumBanner(root, {
      onScratchStart: () => {
        sendGaEvent(EVENT_NAMES.SCRATCH_START, undefined, { once: true });
      },
      onRevealComplete: () => {
        sendGaEvent(EVENT_NAMES.REVEAL_COMPLETE, undefined, { once: true });
      },
      onClick: (redirectPath) => {
        sendGaEvent(EVENT_NAMES.CLICK, { target_path: redirectPath });
        openExternalUrl(redirectPath);
      },
      onFailure: (error) => {
        console.error('[album-banner] init failed, rendering fallback', error);
        sendGaEvent('banner_error', { message: error.message });
      },
    });

    observeImpression(banner.rootElement, banner.mode);
  } catch (error) {
    // mount itself failed catastrophically (not asset/controller failure — those produce fallback).
    console.error('[album-banner] mount failed', error);
    sendGaEvent('banner_error', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

function observeImpression(target: Element, mode: 'scratch' | 'fallback'): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          sendGaEvent(EVENT_NAMES.IMPRESSION, { mode }, { once: true });
          observer.disconnect();
          return;
        }
      }
    },
    { threshold: [0.5] },
  );
  observer.observe(target);
}
