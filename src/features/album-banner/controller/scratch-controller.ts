import {
  GRID_SIZE,
  RADIUS_RATIO,
  REVEAL_SAMPLE_INTERVAL_MS,
  REVEAL_THRESHOLD,
  TAP_MAX_PX,
} from '../shared/constants';
import type { BannerConfig, ErasureGrid, Point } from '../shared/types';
import { createGrid, markSegment } from '../model/erasure-grid';
import { computeReveal } from '../model/scratch-progress';
import { sampleLine } from '../model/line-sampler';
import { loadImage } from './image-loader';

export type ScratchControllerDeps = {
  readonly coverCanvas: HTMLCanvasElement;
  readonly scratchCanvas: HTMLCanvasElement;
  readonly config: BannerConfig;
  readonly onScratchStart: () => void;
  readonly onRevealComplete: () => void;
  readonly onClick: () => void;
  readonly onFirstMove?: () => void;
};

export type ScratchController = {
  destroy: () => void;
};

type CanvasContexts = {
  cover: CanvasRenderingContext2D;
  scratch: CanvasRenderingContext2D;
};

type Images = {
  cover: HTMLImageElement;
  nagar: HTMLImageElement;
};

export async function startScratchController(
  deps: ScratchControllerDeps,
): Promise<ScratchController> {
  const { coverCanvas, scratchCanvas, config } = deps;

  const cover2d = coverCanvas.getContext('2d');
  const scratch2d = scratchCanvas.getContext('2d');
  if (cover2d === null || scratch2d === null) {
    throw new Error('Canvas 2D context not available');
  }
  const ctx: CanvasContexts = { cover: cover2d, scratch: scratch2d };

  const [cover, nagar] = await Promise.all([
    loadImage(config.coverUrl),
    loadImage(config.nagarUrl),
  ]);
  const images: Images = { cover, nagar };

  let grid: ErasureGrid = createGrid(GRID_SIZE);
  let cssSize = 0;

  const fitSize = (): void => {
    const parent = scratchCanvas.parentElement;
    const rect = parent !== null
      ? parent.getBoundingClientRect()
      : scratchCanvas.getBoundingClientRect();
    cssSize = Math.max(1, Math.min(rect.width, rect.height));
    const dpr = window.devicePixelRatio || 1;
    const pixelSize = Math.round(cssSize * dpr);
    const cssPx = `${cssSize}px`;

    for (const canvas of [coverCanvas, scratchCanvas]) {
      if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
        canvas.width = pixelSize;
        canvas.height = pixelSize;
      }
      canvas.style.width = cssPx;
      canvas.style.height = cssPx;
    }

    ctx.cover.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.scratch.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawCover = (): void => {
    const { cover: img } = images;
    const scale = Math.max(cssSize / img.width, cssSize / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.cover.clearRect(0, 0, cssSize, cssSize);
    ctx.cover.drawImage(img, (cssSize - drawW) / 2, (cssSize - drawH) / 2, drawW, drawH);
  };

  const drawNagar = (): void => {
    const { nagar: img } = images;
    const scale = Math.max(cssSize / img.width, cssSize / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.scratch.globalCompositeOperation = 'source-over';
    ctx.scratch.clearRect(0, 0, cssSize, cssSize);
    ctx.scratch.drawImage(img, (cssSize - drawW) / 2, (cssSize - drawH) / 2, drawW, drawH);
  };

  const reapplyMask = (): void => {
    const cellSize = cssSize / grid.size;
    const ctxS = ctx.scratch;
    ctxS.globalCompositeOperation = 'destination-out';
    ctxS.fillStyle = '#000';
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        if (grid.cells[y * grid.size + x] === 1) {
          ctxS.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1);
        }
      }
    }
    ctxS.globalCompositeOperation = 'source-over';
  };

  const eraseSegment = (fromCss: Point, toCss: Point): void => {
    const radiusCss = cssSize * RADIUS_RATIO;
    const points = sampleLine(fromCss, toCss, radiusCss * 0.5);

    const ctxS = ctx.scratch;
    ctxS.globalCompositeOperation = 'destination-out';
    ctxS.fillStyle = '#000';
    ctxS.beginPath();
    for (const p of points) {
      ctxS.moveTo(p.x + radiusCss, p.y);
      ctxS.arc(p.x, p.y, radiusCss, 0, Math.PI * 2);
    }
    ctxS.fill();
    ctxS.globalCompositeOperation = 'source-over';

    markSegment(
      grid,
      { x: fromCss.x / cssSize, y: fromCss.y / cssSize },
      { x: toCss.x / cssSize, y: toCss.y / cssSize },
      RADIUS_RATIO,
    );
  };

  const fullRender = (): void => {
    fitSize();
    drawCover();
    drawNagar();
    reapplyMask();
  };

  fullRender();

  let activePointerId: number | null = null;
  let lastTouchPoint: Point | null = null;
  let lastMousePoint: Point | null = null;
  let touchDownPoint: Point | null = null;
  let movedDuringPress = false;
  let scratchStarted = false;
  let revealCompleted = false;
  let lastSampleAt = 0;

  const getLocalPoint = (event: PointerEvent): Point => {
    const rect = scratchCanvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const maybeSampleReveal = (now: number): void => {
    if (revealCompleted) return;
    if (now - lastSampleAt < REVEAL_SAMPLE_INTERVAL_MS) return;
    lastSampleAt = now;
    const state = computeReveal(grid, REVEAL_THRESHOLD);
    if (state.thresholdReached) {
      revealCompleted = true;
      deps.onRevealComplete();
    }
  };

  const fireScratchStartOnce = (): void => {
    if (scratchStarted) return;
    scratchStarted = true;
    deps.onScratchStart();
    deps.onFirstMove?.();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.pointerType === 'mouse') {
      // Desktop: hover-to-scratch, native click handles redirect.
      return;
    }
    activePointerId = event.pointerId;
    movedDuringPress = false;
    const p = getLocalPoint(event);
    touchDownPoint = p;
    lastTouchPoint = p;
    try {
      scratchCanvas.setPointerCapture(event.pointerId);
    } catch {
      // ignore — some browsers reject in synthetic cases
    }
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    const current = getLocalPoint(event);

    if (event.pointerType === 'mouse') {
      const from = lastMousePoint ?? current;
      lastMousePoint = current;
      fireScratchStartOnce();
      eraseSegment(from, current);
      maybeSampleReveal(event.timeStamp);
      return;
    }

    if (activePointerId === null || event.pointerId !== activePointerId) return;
    const from = lastTouchPoint ?? current;

    if (touchDownPoint !== null && !movedDuringPress) {
      const dx = current.x - touchDownPoint.x;
      const dy = current.y - touchDownPoint.y;
      if (Math.hypot(dx, dy) > TAP_MAX_PX) {
        movedDuringPress = true;
        fireScratchStartOnce();
      }
    }

    if (movedDuringPress) {
      eraseSegment(from, current);
      maybeSampleReveal(event.timeStamp);
    }

    lastTouchPoint = current;
  };

  const releasePointer = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') return;
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    try {
      scratchCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    activePointerId = null;
    lastTouchPoint = null;
    touchDownPoint = null;
    movedDuringPress = false;
  };

  const onPointerUp = (event: PointerEvent): void => {
    releasePointer(event);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    releasePointer(event);
  };

  const onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      lastMousePoint = null;
    }
  };

  const onPointerEnter = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      lastMousePoint = getLocalPoint(event);
    }
  };

  const onClick = (): void => {
    // if (revealCompleted) {
      deps.onClick();
    // }
  };

  const onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  scratchCanvas.addEventListener('pointerdown', onPointerDown);
  scratchCanvas.addEventListener('pointermove', onPointerMove);
  scratchCanvas.addEventListener('pointerup', onPointerUp);
  scratchCanvas.addEventListener('pointercancel', onPointerCancel);
  scratchCanvas.addEventListener('pointerleave', onPointerLeave);
  scratchCanvas.addEventListener('pointerenter', onPointerEnter);
  scratchCanvas.addEventListener('click', onClick);
  scratchCanvas.addEventListener('contextmenu', onContextMenu);

  const resizeObserver = new ResizeObserver(() => {
    const parent = scratchCanvas.parentElement;
    if (parent === null) return;
    const rect = parent.getBoundingClientRect();
    const side = Math.max(1, Math.min(rect.width, rect.height));
    if (Math.abs(side - cssSize) > 0.5) {
      fullRender();
    }
  });
  const observeTarget = scratchCanvas.parentElement ?? scratchCanvas;
  resizeObserver.observe(observeTarget);

  return {
    destroy: () => {
      scratchCanvas.removeEventListener('pointerdown', onPointerDown);
      scratchCanvas.removeEventListener('pointermove', onPointerMove);
      scratchCanvas.removeEventListener('pointerup', onPointerUp);
      scratchCanvas.removeEventListener('pointercancel', onPointerCancel);
      scratchCanvas.removeEventListener('pointerleave', onPointerLeave);
      scratchCanvas.removeEventListener('pointerenter', onPointerEnter);
      scratchCanvas.removeEventListener('click', onClick);
      scratchCanvas.removeEventListener('contextmenu', onContextMenu);
      resizeObserver.disconnect();
    },
  };
}
