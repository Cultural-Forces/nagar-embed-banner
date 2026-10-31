/**
 * A soot field is a square grid of values in 0..1. A level then decides how
 * much of it is covered: a cell is covered where its value is below the level,
 * with a soft edge of `softness`. Low values are covered first, so the shape of
 * the field sets the order in which soot appears or goes away.
 */

/** Smooth blotchy noise: random values on a coarse grid, interpolated. */
export function createValueNoise(size: number, cells: number, random: () => number): Float32Array {
  const grid = new Float32Array((cells + 1) * (cells + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = random();

  const at = (gx: number, gy: number): number => grid[gy * (cells + 1) + gx] ?? 0;
  const noise = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const gy = Math.floor(fy);
    const ty = smooth(fy - gy);
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const gx = Math.floor(fx);
      const tx = smooth(fx - gx);
      const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * tx;
      const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * tx;
      noise[y * size + x] = top + (bottom - top) * ty;
    }
  }

  return noise;
}

/**
 * Order in which the rest of the nagar dissolves on reveal: around what was
 * already erased first, the untouched parts last. `erasedAlpha` is a blurred
 * copy of the erase mask, one alpha value (0–255) per cell.
 */
export function createDissolveField(
  size: number,
  erasedAlpha: Uint8ClampedArray,
  cells: number,
  random: () => number,
): Float32Array {
  const noise = createValueNoise(size, cells, random);
  const field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i++) {
    const untouched = 1 - (erasedAlpha[i] ?? 0) / 255;
    field[i] = 0.45 * untouched + 0.4 * (noise[i] ?? 0) + 0.15 * random();
  }
  return equalizeField(field);
}

/** Order in which soot settles back: from the edges inwards, unevenly. */
export function createSettleField(size: number, cells: number, random: () => number): Float32Array {
  const noise = createValueNoise(size, cells, random);
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const fromEdge = Math.min(u, 1 - u, v, 1 - v) * 2;
      const i = y * size + x;
      field[i] = 0.65 * fromEdge + 0.25 * (noise[i] ?? 0) + 0.1 * random();
    }
  }
  return equalizeField(field);
}

const EQUALIZE_BINS = 1024;

/**
 * Remaps values to their rank in 0..1 (histogram equalization), keeping the
 * order. Mixed noise bunches up around the middle; after this a level of 0.3
 * covers 30% of the field, so coverage grows evenly with the level.
 */
export function equalizeField(field: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (const value of field) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min;
  if (field.length === 0 || span === 0) return field.fill(0.5);

  const binOf = (value: number): number =>
    Math.min(EQUALIZE_BINS - 1, Math.floor(((value - min) / span) * EQUALIZE_BINS));

  const counts = new Uint32Array(EQUALIZE_BINS);
  for (const value of field) counts[binOf(value)] = (counts[binOf(value)] ?? 0) + 1;

  // share of values in lower bins plus half of the own bin
  const rank = new Float32Array(EQUALIZE_BINS);
  let below = 0;
  for (let b = 0; b < EQUALIZE_BINS; b++) {
    const count = counts[b] ?? 0;
    rank[b] = (below + count / 2) / field.length;
    below += count;
  }

  for (let i = 0; i < field.length; i++) field[i] = rank[binOf(field[i] ?? 0)] ?? 0;
  return field;
}

/** Writes coverage at `level` into the alpha channel of RGBA data. */
export function writeFieldAlpha(
  field: Float32Array,
  level: number,
  softness: number,
  rgba: Uint8ClampedArray,
): void {
  for (let i = 0; i < field.length; i++) {
    const coverage = (level - (field[i] ?? 1)) / softness;
    rgba[i * 4 + 3] = coverage <= 0 ? 0 : coverage >= 1 ? 255 : Math.round(coverage * 255);
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
