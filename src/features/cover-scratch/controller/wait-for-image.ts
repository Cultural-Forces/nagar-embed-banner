/**
 * Resolves once the <img> has loaded. Unlike `img.decode()` this does not
 * wait for a rendered frame, which never comes in a background tab.
 */
export function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete) {
    return img.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error(`Failed to load image: ${img.currentSrc || img.src}`));
  }

  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
    const onLoad = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error(`Failed to load image: ${img.currentSrc || img.src}`));
    };
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
  });
}
