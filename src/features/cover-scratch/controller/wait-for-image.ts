/**
 * Like `waitForImage`, but on a failed load sets the same src again once
 * after `retryDelayMs`: on a flaky network the second request often gets through.
 */
export async function waitForImageWithRetry(img: HTMLImageElement, retryDelayMs: number): Promise<void> {
  try {
    await waitForImage(img);
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
    // Setting src, even to the same value, starts a new request. `complete`
    // may still report the old broken request right after it, so only events count.
    const loaded = listenForLoad(img);
    img.src = img.src;
    await loaded;
  }
}

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

  return listenForLoad(img);
}

function listenForLoad(img: HTMLImageElement): Promise<void> {
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
