import {
  BRUSH_TEXTURE_SIZE,
  ERASED_ALPHA_CUTOFF,
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
import { createBrushStamp } from './brush-stamp';

export type ScratchControllerDeps = {
  readonly stage: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly nagar: HTMLImageElement;
  readonly onScratchStart: () => void;
  readonly onThresholdReached: () => void;
};

export type ScratchController = {
  /** Stops erasing; the canvas stays until the caller removes it. */
  disable: () => void;
  destroy: () => void;
};

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
  if (ctx === null || maskCtx === null || probeCtx === null) {
    throw new Error('Canvas 2D context not available');
  }

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

  const render = (): void => {
    fitSize();
    drawNagar();
    applyMask();
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

  const eraseSegment = (from: Point, to: Point): void => {
    if (!scratchStarted) {
      scratchStarted = true;
      deps.onScratchStart();
    }

    for (const point of sampleLine(from, to, RADIUS_RATIO * STAMP_SPACING_RATIO)) {
      const angle = Math.random() * Math.PI * 2;
      const alpha = STAMP_ALPHA_MIN + Math.random() * (STAMP_ALPHA_MAX - STAMP_ALPHA_MIN);
      stampOnto(ctx, cssSize, 'destination-out', point, angle, alpha);
      stampOnto(maskCtx, MASK_SIZE, 'source-over', point, angle, alpha);
    }
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
    disable,
    destroy: () => {
      disable();
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
