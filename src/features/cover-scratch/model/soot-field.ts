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

export type SootField = {
  /** Order of covering: lower values are covered at lower levels. */
  readonly values: Float32Array;
  /** Opacity multiplier: 1 on the cover, thinning to 0 at the outer edge. */
  readonly fade: Float32Array;
};

/**
 * Order in which soot settles back after the reveal, on the cover and around
 * it in one field, so there is no seam at the cover edge. It starts at the
 * edge and grows both ways: inwards over the cover and outwards onto the page.
 * Coarse noise sets how far it reaches at each spot (long tongues here, barely
 * a touch there), finer noise rags the front.
 *
 * The field is a `size` × `size` square: the cover in the middle, `margin`
 * (share of the field side) of page around it. Not equalized, so a level
 * reads as reach; at `SOOT_FULL_LEVEL` about a third of the cover is covered.
 */
export function createSootField(
  size: number,
  margin: number,
  cells: number,
  random: () => number,
): SootField {
  const reachNoise = createValueNoise(size, SOOT_REACH_CELLS, random);
  const noise = createValueNoise(size, cells, random);
  const values = new Float32Array(size * size);
  const fade = new Float32Array(size * size);
  const cover = 1 - 2 * margin;
  const half = cover / 2;

  for (let y = 0; y < size; y++) {
    const oy = Math.abs((y + 0.5) / size - 0.5) - half;
    for (let x = 0; x < size; x++) {
      const ox = Math.abs((x + 0.5) / size - 0.5) - half;
      const i = y * size + x;
      const inside = ox <= 0 && oy <= 0;

      // 0 at the cover edge, 1 where soot stops at full level when the reach is 1:
      // SOOT_INSIDE_DEPTH of the cover side inwards, the whole margin outwards
      const outward = Math.hypot(Math.max(0, ox), Math.max(0, oy)) / margin;
      const fromEdge = inside ? -Math.max(ox, oy) / cover / SOOT_INSIDE_DEPTH : outward;

      const reach = SOOT_REACH_MIN + (SOOT_REACH_MAX - SOOT_REACH_MIN) * (reachNoise[i] ?? 0);
      values[i] = 0.7 * (fromEdge / reach) + 0.3 * (noise[i] ?? 0) + 0.1 * random();
      // on the page it thins out, and always to nothing at the canvas edge
      fade[i] = inside ? 1 : (1 - ramp(fromEdge / reach, 0.1, 1)) * (1 - ramp(outward, 0.75, 1));
    }
  }

  return { values, fade };
}

/** Level at which the soot has settled back fully. */
export const SOOT_FULL_LEVEL = 0.95;
/** How deep into the cover soot reaches at full level, as a share of its side. */
const SOOT_INSIDE_DEPTH = 0.09;
/** Coarse noise for the reach: few cells, so tongues are wide. */
const SOOT_REACH_CELLS = 4;
const SOOT_REACH_MIN = 0.45;
const SOOT_REACH_MAX = 1.7;

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

/** Writes coverage at `level` into the alpha channel of RGBA data, times `scale` if given. */
export function writeFieldAlpha(
  field: Float32Array,
  level: number,
  softness: number,
  rgba: Uint8ClampedArray,
  scale?: Float32Array,
): void {
  for (let i = 0; i < field.length; i++) {
    const coverage = Math.min(1, Math.max(0, (level - (field[i] ?? 1)) / softness));
    rgba[i * 4 + 3] = Math.round(coverage * (scale === undefined ? 1 : (scale[i] ?? 0)) * 255);
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 0 below `from`, 1 above `to`, smooth in between. */
function ramp(value: number, from: number, to: number): number {
  return smooth(Math.min(1, Math.max(0, (value - from) / (to - from))));
}
