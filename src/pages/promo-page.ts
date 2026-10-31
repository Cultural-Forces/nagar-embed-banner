import { env } from '../shared/config/env';
import { loadGa } from '../shared/lib/analytics/load-ga';
import { sendGaEvent } from '../shared/lib/analytics/send-ga-event';
import { mountCoverScratch } from '../features/cover-scratch';
import { trackLinkClicks } from '../features/link-tracking/track-link-clicks';

/** GA4 events; page_view is sent by gtag itself. */
const EVENT_NAMES = {
  SCRATCH_START: 'scratch_start',
  COVER_REVEAL: 'cover_reveal',
  PLATFORM_CLICK: 'platform_click',
  SOCIAL_CLICK: 'social_click',
  COVER_ERROR: 'cover_error',
} as const;

const HINT_VARIANTS: readonly string[] = ['text-gesture', 'text', 'gesture', 'cutout'];

export function renderPromoPage(doc: Document): void {
  loadGa(env.GA4_ID);

  trackLinkClicks(doc, {
    onPlatformClick: (platform) => sendGaEvent(EVENT_NAMES.PLATFORM_CLICK, { platform }),
    onSocialClick: (network) => sendGaEvent(EVENT_NAMES.SOCIAL_CLICK, { network }),
  });

  const coverRoot = doc.querySelector<HTMLElement>('[data-cover]');
  if (coverRoot === null) return;

  // TEMP: ?hint=text|gesture|cutout|text-gesture switches the hint on the soot
  // while we compare variants. Remove once one is chosen.
  const hint = new URLSearchParams(doc.location.search).get('hint');
  if (hint !== null && HINT_VARIANTS.includes(hint)) {
    coverRoot.dataset.hint = hint;
  }

  mountCoverScratch(coverRoot, {
    onScratchStart: () => {
      sendGaEvent(EVENT_NAMES.SCRATCH_START, undefined, { once: true });
    },
    onReveal: (method) => {
      sendGaEvent(EVENT_NAMES.COVER_REVEAL, { method }, { once: true });
    },
    onFailure: (error) => {
      console.error('[cover-scratch] init failed', error);
      sendGaEvent(EVENT_NAMES.COVER_ERROR, { message: error.message });
    },
  }).catch((error: unknown) => {
    // markup is broken; the cover stays static via CSS
    console.error('[cover-scratch] mount failed', error);
    coverRoot.classList.remove('cover--loading');
    coverRoot.removeAttribute('aria-busy');
    coverRoot.classList.add('cover--static');
  });
}
