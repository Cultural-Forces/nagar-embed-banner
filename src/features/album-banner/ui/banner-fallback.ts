export type BannerFallbackProps = {
  readonly fallbackImageUrl: string;
  readonly redirectPath: string;
  readonly label: string;
};

export type BannerFallbackRefs = {
  readonly root: HTMLAnchorElement;
};

export function createBannerFallback(props: BannerFallbackProps): BannerFallbackRefs {
  const root = document.createElement('a');
  root.className = 'album-banner__fallback';
  root.href = props.redirectPath;
  root.target = '_blank';
  root.rel = 'noopener noreferrer';
  root.setAttribute('aria-label', props.label);

  const image = document.createElement('img');
  image.className = 'album-banner__fallback-image';
  image.src = props.fallbackImageUrl;
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'eager';
  image.addEventListener('error', () => {
    image.classList.add('album-banner__fallback-image--hidden');
  });

  const label = document.createElement('span');
  label.className = 'album-banner__fallback-label';
  label.textContent = props.label;

  root.append(image, label);

  return { root };
}
