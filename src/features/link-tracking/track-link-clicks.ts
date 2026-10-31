export type LinkClickHandlers = {
  readonly onPlatformClick: (platform: string) => void;
  readonly onSocialClick: (network: string) => void;
};

/**
 * One delegated listener for links marked with `data-platform` or
 * `data-social`. Links stay plain <a target="_blank">, so the page is not
 * unloaded and the event has time to leave. Middle click counts too.
 */
export function trackLinkClicks(root: Document | HTMLElement, handlers: LinkClickHandlers): () => void {
  const onClick = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return;
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest<HTMLAnchorElement>('a[data-platform], a[data-social]');
    if (link === null) return;

    const { platform, social } = link.dataset;
    if (platform !== undefined) {
      handlers.onPlatformClick(platform);
    } else if (social !== undefined) {
      handlers.onSocialClick(social);
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('auxclick', onClick);

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('auxclick', onClick);
  };
}
