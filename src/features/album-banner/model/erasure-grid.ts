import type { ErasureGrid, Point } from '../shared/types';

export function createGrid(size: number): ErasureGrid {
  return { size, cells: new Uint8Array(size * size) };
}

function markCircle(
  grid: ErasureGrid,
  centerNorm: Point,
  radiusNorm: number,
): void {
  const { size, cells } = grid;
  const cx = centerNorm.x * size;
  const cy = centerNorm.y * size;
  const r = radiusNorm * size;
  const r2 = r * r;

  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(size - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(size - 1, Math.ceil(cy + r));

  for (let y = minY; y <= maxY; y++) {
    const dy = y + 0.5 - cy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= r2) {
        cells[y * size + x] = 1;
      }
    }
  }
}

export function markSegment(
  grid: ErasureGrid,
  fromNorm: Point,
  toNorm: Point,
  radiusNorm: number,
): void {
  const dx = toNorm.x - fromNorm.x;
  const dy = toNorm.y - fromNorm.y;
  const distance = Math.hypot(dx, dy);
  const step = Math.max(radiusNorm * 0.5, 1 / grid.size);
  const steps = Math.max(1, Math.ceil(distance / step));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    markCircle(
      grid,
      { x: fromNorm.x + dx * t, y: fromNorm.y + dy * t },
      radiusNorm,
    );
  }
}

export function countErased(grid: ErasureGrid): number {
  let count = 0;
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === 1) count++;
  }
  return count;
}
