import {
  FIELD_NOISE_CELLS,
  FIELD_SOFTNESS,
  HALO_FIELD_SIZE,
  HALO_MARGIN_RATIO,
  HALO_SEAM_OVERLAP_PX,
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
  /**
   * `amount` 0..1: how much of the soot has settled back (0 = none, 1 = all).
   * `outsideOnly` keeps the cover itself clear: before the reveal the nagar
   * canvas is there, and soot over it would not erase.
   */
  draw: (amount: number, outsideOnly?: boolean) => void;
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
  let lastOutsideOnly = false;

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
  // One repeating pattern rather than nine drawn tiles: at a fractional cover
  // size the tiles' edges are half-transparent pixels, and the black page
  // showed through where they met, as a thin frame along the cover edges.
  // The pattern repeats a tile with the nagar drawn at the cover's size in
  // device pixels, the same drawImage as on the nagar canvas, so the texture
  // matches it. A pattern made straight from the <img> repeats its file at
  // the file's own size, which srcset makes differ from naturalWidth.
  const tile = document.createElement('canvas');
  const tileCtx = tile.getContext('2d');
  let pattern: CanvasPattern | null = null;
  let patternKey = '';
  const drawTiledNagar = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const tileSize = Math.max(1, Math.round(coverSize * dpr));
    const key = `${nagar.currentSrc} ${tileSize}`;
    if (tileCtx === null) return;
    if (pattern === null || patternKey !== key) {
      tile.width = tileSize;
      tile.height = tileSize;
      tileCtx.drawImage(nagar, 0, 0, tileSize, tileSize);
      pattern = ctx.createPattern(tile, 'repeat');
      patternKey = key;
    }
    if (pattern === null) return;
    pattern.setTransform(
      new DOMMatrix().translateSelf(margin, margin).scaleSelf(coverSize / tileSize, coverSize / tileSize),
    );
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, side, side);
  };

  const draw = (amount: number, outsideOnly = false): void => {
    const sizeChanged = Math.abs(stage.getBoundingClientRect().width - coverSize) > 0.5;
    if (!sizeChanged && amount === lastAmount && outsideOnly === lastOutsideOnly) return;
    lastAmount = amount;
    lastOutsideOnly = outsideOnly;
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
    if (outsideOnly) {
      // a little short of the cover edge, so the soot covers the seam with the nagar canvas
      const inset = HALO_SEAM_OVERLAP_PX;
      ctx.clearRect(margin + inset, margin + inset, coverSize - 2 * inset, coverSize - 2 * inset);
    }
  };

  fitSize();

  return { draw };
}
