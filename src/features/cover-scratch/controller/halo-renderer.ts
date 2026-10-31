import {
  FIELD_NOISE_CELLS,
  FIELD_SOFTNESS,
  HALO_FIELD_SIZE,
  HALO_MARGIN_RATIO,
  MAX_DPR,
} from '../shared/constants';
import { createSootField, SOOT_FULL_LEVEL, writeFieldAlpha } from '../model/soot-field';

export type HaloRendererDeps = {
  readonly stage: HTMLElement;
  /** Square canvas centred on the stage, `HALO_MARGIN_RATIO` of it wider on every side. */
  readonly canvas: HTMLCanvasElement;
  readonly nagar: HTMLImageElement;
};

export type HaloRenderer = {
  /** `amount` 0..1: how much of the soot has settled back (0 = none, 1 = all). */
  draw: (amount: number) => void;
};

/**
 * Soot that settles back after the reveal, over the cover and around it in one
 * layer: it creeps in from the cover edges and spills out onto the page, so the
 * cover never ends in a hard line. The texture is the nagar repeated around the
 * cover, which continues it without a seam; on the page it thins out into black.
 */
export function createHaloRenderer(deps: HaloRendererDeps): HaloRenderer {
  const { stage, canvas, nagar } = deps;
  const ctx = canvas.getContext('2d');
  const field = document.createElement('canvas');
  field.width = HALO_FIELD_SIZE;
  field.height = HALO_FIELD_SIZE;
  const fieldCtx = field.getContext('2d');
  if (ctx === null || fieldCtx === null) {
    throw new Error('Canvas 2D context not available');
  }

  const fieldMargin = HALO_MARGIN_RATIO / (1 + 2 * HALO_MARGIN_RATIO);
  const { values, fade } = createSootField(HALO_FIELD_SIZE, fieldMargin, FIELD_NOISE_CELLS, Math.random);
  const image = fieldCtx.createImageData(HALO_FIELD_SIZE, HALO_FIELD_SIZE);
  image.data.fill(255);

  let coverSize = 0;
  let margin = 0;
  let side = 0;
  let lastAmount = -1;

  const fitSize = (): void => {
    coverSize = Math.max(1, stage.getBoundingClientRect().width);
    margin = coverSize * HALO_MARGIN_RATIO;
    side = coverSize + 2 * margin;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pixelSide = Math.round(side * dpr);
    if (canvas.width !== pixelSide || canvas.height !== pixelSide) {
      canvas.width = pixelSide;
      canvas.height = pixelSide;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // The nagar where the cover is, repeated around it. Its opposite edges have
  // the same brightness, so the repeat runs on past the cover edge without a
  // seam; mirroring would also be seamless but shows a crease along the edge.
  const drawTiledNagar = (): void => {
    for (const fx of [-1, 0, 1]) {
      for (const fy of [-1, 0, 1]) {
        ctx.drawImage(nagar, margin + fx * coverSize, margin + fy * coverSize, coverSize, coverSize);
      }
    }
  };

  const draw = (amount: number): void => {
    const sizeChanged = Math.abs(stage.getBoundingClientRect().width - coverSize) > 0.5;
    if (!sizeChanged && amount === lastAmount) return;
    lastAmount = amount;
    if (sizeChanged) fitSize();

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, side, side);
    if (amount <= 0) return;

    drawTiledNagar();

    // keep it only where soot has settled, thinning out on the page
    writeFieldAlpha(values, Math.min(1, amount) * SOOT_FULL_LEVEL, FIELD_SOFTNESS, image.data, fade);
    fieldCtx.putImageData(image, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(field, 0, 0, side, side);
    ctx.globalCompositeOperation = 'source-over';
  };

  fitSize();

  return { draw };
}
