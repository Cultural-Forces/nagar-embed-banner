export type BannerHintRefs = {
  readonly element: HTMLElement;
  hide: () => void;
};

export function createBannerHint(text: string): BannerHintRefs {
  const element = document.createElement('div');
  element.className = 'album-banner__hint';
  element.textContent = text;

  return {
    element,
    hide: () => element.classList.add('album-banner__hint--hidden'),
  };
}
