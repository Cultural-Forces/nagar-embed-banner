import { env } from '../shared/config/env';
import { loadGa } from '../shared/lib/analytics/load-ga';
import { sendGaEvent } from '../shared/lib/analytics/send-ga-event';
import { mountCoverScratch, type CoverScratchInstance } from '../features/cover-scratch';
import { mountRecordSleeve } from '../features/record-sleeve';
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
  const cover = coverRoot === null ? null : startCover(doc, coverRoot);

  const sleeveRoot = doc.querySelector<HTMLElement>('[data-sleeve]');
  if (sleeveRoot !== null) {
    mountRecordSleeve(sleeveRoot, {
      // opens the cover in the hero too, so going back up finds it open
      onRevealRequest: () => {
        void cover?.then((instance) => instance?.reveal('sleeve'));
      },
    });
  }
}

function startCover(doc: Document, coverRoot: HTMLElement): Promise<CoverScratchInstance | null> {
  // TEMP: ?hint=text|gesture|cutout|text-gesture switches the hint on the soot
  // while we compare variants. Remove once one is chosen.
  const hint = new URLSearchParams(doc.location.search).get('hint');
  if (hint !== null && HINT_VARIANTS.includes(hint)) {
    coverRoot.dataset.hint = hint;
  }

  return mountCoverScratch(coverRoot, {
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
    return null;
  });
}
