import { createBrushAlpha } from '../model/brush-alpha';

/** White brush texture whose alpha comes from `createBrushAlpha`. */
export function createBrushStamp(size: number, random: () => number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context not available');
  }

  const alpha = createBrushAlpha(size, random);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < alpha.length; i++) {
    const offset = i * 4;
    image.data[offset] = 255;
    image.data[offset + 1] = 255;
    image.data[offset + 2] = 255;
    image.data[offset + 3] = alpha[i] ?? 0;
  }
  ctx.putImageData(image, 0, 0);

  return canvas;
}
