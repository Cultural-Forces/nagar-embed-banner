import {
  BRUSH_TEXTURE_SIZE,
  DISSOLVE_BLUR_SIZE,
  ERASED_ALPHA_CUTOFF,
  FIELD_NOISE_CELLS,
  FIELD_SIZE,
  FIELD_SOFTNESS,
  MASK_SIZE,
  MAX_DPR,
  PROBE_SIZE,
  RADIUS_RATIO,
  REVEAL_SAMPLE_INTERVAL_MS,
  REVEAL_THRESHOLD,
  STAMP_ALPHA_MAX,
  STAMP_ALPHA_MIN,
  STAMP_SPACING_RATIO,
} from '../shared/constants';
import type { Point } from '../shared/types';
import { computeErasedRatio } from '../model/scratch-progress';
import { sampleLine } from '../model/line-sampler';
import { easeInOutCubic } from '../model/easing';
import { createDissolveField, writeFieldAlpha } from '../model/soot-field';
import { createBrushStamp } from './brush-stamp';

export type ScratchControllerDeps = {
  readonly stage: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly nagar: HTMLImageElement;
  readonly onScratchStart: () => void;
  readonly onThresholdReached: () => void;
};

export type ScratchController = {
  /**
   * Soot gathers on the square in blotches, the dissolve played backwards;
   * erasing starts once it is whole. Resolves then.
   */
  appear: (durationMs: number) => Promise<void>;
  /** Stops erasing; the canvas stays until the caller removes it. */
  disable: () => void;
  /** Stops erasing and dissolves the rest of the nagar; resolves when it is gone. */
  dissolve: (durationMs: number) => Promise<void>;
  /** Wipes a stroke along `path` by itself; stops as soon as the person starts. */
  playDemoStroke: (path: readonly Point[], durationMs: number) => void;
  cutText: (text: string, font: CutTextFont, center: Point) => void;
  destroy: () => void;
};

export type CutTextFont = {
  readonly family: string;
  readonly weight: string;
  /** Font size as a share of the square side. */
  readonly sizeRatio: number;
};

/**
 * What the canvas shows:
 * - appear: the nagar only where the appear field is covered at `level`;
 * - scratch: the nagar minus the erase mask;
 * - dissolve: the same, minus the dissolve field at `level`;
 * - done: nothing; soot that settles back later is drawn around and over the
 *   cover by the halo renderer.
 */
type RenderMode =
  | { readonly kind: 'appear'; readonly level: number }
  | { readonly kind: 'scratch' }
  | { readonly kind: 'dissolve'; readonly level: number }
  | { readonly kind: 'done' };

/**
 * Strokes are stamped twice: onto the visible canvas (to erase the nagar) and
 * onto an offscreen mask of fixed size. The mask survives resizes and is what
 * the progress is measured on. Points are normalized to 0..1 of the square.
 */
export function startScratchController(deps: ScratchControllerDeps): ScratchController {
  const { stage, canvas, nagar } = deps;

  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = MASK_SIZE;
  mask.height = MASK_SIZE;
  const maskCtx = mask.getContext('2d');
  const probe = document.createElement('canvas');
  probe.width = PROBE_SIZE;
  probe.height = PROBE_SIZE;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });
  const field = document.createElement('canvas');
  field.width = FIELD_SIZE;
  field.height = FIELD_SIZE;
  const fieldCtx = field.getContext('2d');
  if (ctx === null || maskCtx === null || probeCtx === null || fieldCtx === null) {
    throw new Error('Canvas 2D context not available');
  }
  const fieldImage = fieldCtx.createImageData(FIELD_SIZE, FIELD_SIZE);
  fieldImage.data.fill(255);

  let mode: RenderMode = { kind: 'scratch' };
  let dissolveField: Float32Array | null = null;
  let dissolveFrame: number | null = null;
  let appearField: Float32Array | null = null;
  let appearFrame: number | null = null;

  const stamp = createBrushStamp(BRUSH_TEXTURE_SIZE, Math.random);

  let cssSize = 0;
  let enabled = true;
  let scratchStarted = false;
  let thresholdReached = false;
  let lastSampleAt = 0;

  const fitSize = (): void => {
    cssSize = Math.max(1, stage.getBoundingClientRect().width);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pixelSize = Math.round(cssSize * dpr);
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // Same crop as `object-fit: cover` on the <img> it replaces.
  const drawNagar = (): void => {
    const scale = Math.max(cssSize / nagar.naturalWidth, cssSize / nagar.naturalHeight);
    const drawW = nagar.naturalWidth * scale;
    const drawH = nagar.naturalHeight * scale;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cssSize, cssSize);
    ctx.drawImage(nagar, (cssSize - drawW) / 2, (cssSize - drawH) / 2, drawW, drawH);
  };

  const applyMask = (): void => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, cssSize, cssSize);
    ctx.globalCompositeOperation = 'source-over';
  };

  // Coverage of a field at `level`, drawn over the whole square with `operation`.
  const applyField = (values: Float32Array, level: number, operation: GlobalCompositeOperation): void => {
    writeFieldAlpha(values, level, FIELD_SOFTNESS, fieldImage.data);
    fieldCtx.putImageData(fieldImage, 0, 0);
    ctx.globalCompositeOperation = operation;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(field, 0, 0, cssSize, cssSize);
    ctx.globalCompositeOperation = 'source-over';
  };

  const draw = (): void => {
    if (mode.kind === 'done') {
      ctx.clearRect(0, 0, cssSize, cssSize);
      return;
    }

    drawNagar();
    if (mode.kind === 'appear' && appearField !== null) {
      applyField(appearField, mode.level, 'destination-in');
      return;
    }
    applyMask();
    if (mode.kind === 'dissolve' && dissolveField !== null) {
      applyField(dissolveField, mode.level, 'destination-out');
    }
  };

  const render = (): void => {
    fitSize();
    draw();
  };

  // The rest of the nagar goes first around the strokes, so the mask is blurred
  // (drawn tiny, then scaled up) and fed into the dissolve field.
  const buildDissolveField = (): Float32Array => {
    const tiny = document.createElement('canvas');
    tiny.width = DISSOLVE_BLUR_SIZE;
    tiny.height = DISSOLVE_BLUR_SIZE;
    tiny.getContext('2d')?.drawImage(mask, 0, 0, DISSOLVE_BLUR_SIZE, DISSOLVE_BLUR_SIZE);

    fieldCtx.clearRect(0, 0, FIELD_SIZE, FIELD_SIZE);
    fieldCtx.imageSmoothingQuality = 'high';
    fieldCtx.drawImage(tiny, 0, 0, FIELD_SIZE, FIELD_SIZE);
    const { data } = fieldCtx.getImageData(0, 0, FIELD_SIZE, FIELD_SIZE);
    const erasedAlpha = new Uint8ClampedArray(FIELD_SIZE * FIELD_SIZE);
    for (let i = 0; i < erasedAlpha.length; i++) erasedAlpha[i] = data[i * 4 + 3] ?? 0;

    return createDissolveField(FIELD_SIZE, erasedAlpha, FIELD_NOISE_CELLS, Math.random);
  };

  // Nothing is erased yet, so the field is the dissolve one with an empty mask:
  // blotches of noise, in random order.
  const appear = (durationMs: number): Promise<void> => {
    if (mode.kind !== 'scratch' || durationMs <= 0) return Promise.resolve();

    enabled = false;
    appearField = createDissolveField(
      FIELD_SIZE,
      new Uint8ClampedArray(FIELD_SIZE * FIELD_SIZE),
      FIELD_NOISE_CELLS,
      Math.random,
    );
    const endLevel = 1 + FIELD_SOFTNESS;
    mode = { kind: 'appear', level: 0 };
    draw();

    return new Promise((resolve) => {
      let start: number | null = null;
      const tick = (now: number): void => {
        start ??= now;
        const t = Math.min(1, (now - start) / durationMs);
        if (t < 1) {
          mode = { kind: 'appear', level: easeInOutCubic(t) * endLevel };
          draw();
          appearFrame = requestAnimationFrame(tick);
          return;
        }
        appearFrame = null;
        appearField = null;
        mode = { kind: 'scratch' };
        enabled = true;
        draw();
        resolve();
      };
      appearFrame = requestAnimationFrame(tick);
    });
  };

  const dissolve = (durationMs: number): Promise<void> => {
    disable();
    if (mode.kind !== 'scratch') return Promise.resolve();

    const finish = (): void => {
      dissolveFrame = null;
      mode = { kind: 'done' };
      draw();
    };

    if (durationMs <= 0) {
      finish();
      return Promise.resolve();
    }

    dissolveField = buildDissolveField();
    const endLevel = 1 + FIELD_SOFTNESS;

    return new Promise((resolve) => {
      let start: number | null = null;
      const tick = (now: number): void => {
        start ??= now;
        const t = Math.min(1, (now - start) / durationMs);
        mode = { kind: 'dissolve', level: easeInOutCubic(t) * endLevel };
        draw();
        if (t < 1) {
          dissolveFrame = requestAnimationFrame(tick);
        } else {
          finish();
          resolve();
        }
      };
      dissolveFrame = requestAnimationFrame(tick);
    });
  };


  const stampOnto = (
    target: CanvasRenderingContext2D,
    size: number,
    operation: GlobalCompositeOperation,
    point: Point,
    angle: number,
    alpha: number,
  ): void => {
    const diameter = RADIUS_RATIO * size * 2;
    target.save();
    target.globalCompositeOperation = operation;
    target.globalAlpha = alpha;
    target.translate(point.x * size, point.y * size);
    target.rotate(angle);
    target.drawImage(stamp, -diameter / 2, -diameter / 2, diameter, diameter);
    target.restore();
  };

  const stampSegment = (from: Point, to: Point): void => {
    for (const point of sampleLine(from, to, RADIUS_RATIO * STAMP_SPACING_RATIO)) {
      const angle = Math.random() * Math.PI * 2;
      const alpha = STAMP_ALPHA_MIN + Math.random() * (STAMP_ALPHA_MAX - STAMP_ALPHA_MIN);
      stampOnto(ctx, cssSize, 'destination-out', point, angle, alpha);
      stampOnto(maskCtx, MASK_SIZE, 'source-over', point, angle, alpha);
    }
  };

  // A stroke made by the person; the demo stroke and the cut-out text are not.
  const eraseSegment = (from: Point, to: Point): void => {
    if (!scratchStarted) {
      scratchStarted = true;
      deps.onScratchStart();
    }
    stampSegment(from, to);
  };

  let demoFrame: number | null = null;

  const playDemoStroke = (path: readonly Point[], durationMs: number): void => {
    const first = path[0];
    if (first === undefined || !enabled || scratchStarted || demoFrame !== null) return;

    let start: number | null = null;
    let drawn = 0;
    const tick = (now: number): void => {
      // the person took over, or the cover was revealed
      if (!enabled || scratchStarted) {
        demoFrame = null;
        return;
      }
      start ??= now;
      const t = Math.min(1, (now - start) / durationMs);
      const upTo = Math.round(easeInOutCubic(t) * (path.length - 1));
      for (; drawn < upTo; drawn++) {
        stampSegment(path[drawn] ?? first, path[drawn + 1] ?? first);
      }
      demoFrame = t < 1 ? requestAnimationFrame(tick) : null;
    };
    demoFrame = requestAnimationFrame(tick);
  };

  /** Wipes text out of the soot, as if written with a finger. Sizes are 0..1 of the square. */
  const cutText = (text: string, font: CutTextFont, center: Point): void => {
    const px = font.sizeRatio * MASK_SIZE;
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = '#fff';
    maskCtx.font = `${font.weight} ${px}px ${font.family}`;
    maskCtx.textAlign = 'center';
    maskCtx.textBaseline = 'middle';
    // soft, smudged edges instead of crisp type
    maskCtx.shadowColor = '#fff';
    maskCtx.shadowBlur = px * 0.18;
    maskCtx.fillText(text, center.x * MASK_SIZE, center.y * MASK_SIZE);
    maskCtx.restore();
    if (mode.kind === 'scratch') render();
  };

  const sampleProgress = (now: number, force = false): void => {
    if (thresholdReached || !scratchStarted) return;
    if (!force && now - lastSampleAt < REVEAL_SAMPLE_INTERVAL_MS) return;
    lastSampleAt = now;

    probeCtx.clearRect(0, 0, PROBE_SIZE, PROBE_SIZE);
    probeCtx.drawImage(mask, 0, 0, PROBE_SIZE, PROBE_SIZE);
    const { data } = probeCtx.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE);
    if (computeErasedRatio(data, ERASED_ALPHA_CUTOFF) >= REVEAL_THRESHOLD) {
      thresholdReached = true;
      deps.onThresholdReached();
    }
  };

  const getPoint = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  // Mouse erases on hover; touch and pen erase while pressed.
  let lastMousePoint: Point | null = null;
  let activePointerId: number | null = null;
  let lastPressPoint: Point | null = null;

  const releaseActivePointer = (): void => {
    if (activePointerId === null) return;
    try {
      canvas.releasePointerCapture(activePointerId);
    } catch {
      // the capture may already be gone
    }
    activePointerId = null;
    lastPressPoint = null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!enabled || event.pointerType === 'mouse' || event.button !== 0) return;
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    const point = getPoint(event);
    lastPressPoint = point;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignore — some browsers reject in synthetic cases
    }
    eraseSegment(point, point);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!enabled) return;
    const point = getPoint(event);

    if (event.pointerType === 'mouse') {
      eraseSegment(lastMousePoint ?? point, point);
      lastMousePoint = point;
    } else {
      if (event.pointerId !== activePointerId || lastPressPoint === null) return;
      eraseSegment(lastPressPoint, point);
      lastPressPoint = point;
    }
    sampleProgress(event.timeStamp);
  };

  const onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      if (event.type === 'pointerleave') lastMousePoint = null;
    } else if (event.pointerId === activePointerId) {
      releaseActivePointer();
    } else {
      return;
    }
    // a stroke that ends just past the threshold should not wait for the next move
    sampleProgress(event.timeStamp, true);
  };

  const onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('pointerleave', onPointerEnd);
  canvas.addEventListener('contextmenu', onContextMenu);

  const resizeObserver = new ResizeObserver(() => {
    if (Math.abs(stage.getBoundingClientRect().width - cssSize) > 0.5) {
      render();
    }
  });
  resizeObserver.observe(stage);

  render();

  const disable = (): void => {
    enabled = false;
    releaseActivePointer();
  };

  return {
    appear,
    disable,
    dissolve,
    playDemoStroke,
    cutText,
    destroy: () => {
      disable();
      if (dissolveFrame !== null) cancelAnimationFrame(dissolveFrame);
      if (appearFrame !== null) cancelAnimationFrame(appearFrame);
      if (demoFrame !== null) cancelAnimationFrame(demoFrame);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      canvas.removeEventListener('pointerleave', onPointerEnd);
      canvas.removeEventListener('contextmenu', onContextMenu);
      resizeObserver.disconnect();
    },
  };
}
