export type BannerCanvasRefs = {
  readonly root: HTMLElement;
  readonly coverCanvas: HTMLCanvasElement;
  readonly scratchCanvas: HTMLCanvasElement;
};

export function createBannerCanvas(): BannerCanvasRefs {
  const root = document.createElement('div');
  root.className = 'album-banner';

  const coverCanvas = document.createElement('canvas');
  coverCanvas.className = 'album-banner__layer album-banner__cover';

  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.className = 'album-banner__layer album-banner__scratch';

  root.append(coverCanvas, scratchCanvas);

  return { root, coverCanvas, scratchCanvas };
}
