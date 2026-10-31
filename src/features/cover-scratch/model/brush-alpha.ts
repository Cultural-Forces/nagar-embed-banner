const EDGE_HARMONICS = [3, 5, 7, 11] as const;
const EDGE_AMPLITUDE_MIN = 0.02;
const EDGE_AMPLITUDE_RANGE = 0.06;
const SOFT_CORE = 0.35;
const GRAIN_MIN = 0.65;

/**
 * Alpha channel of a soot brush: soft falloff, a ragged edge and grain,
 * so strokes look like wiped soot rather than clean circles.
 * Returns `size * size` values, row by row.
 */
export function createBrushAlpha(size: number, random: () => number): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(size * size);
  const center = (size - 1) / 2;
  const radius = size / 2;

  const harmonics = EDGE_HARMONICS.map((frequency) => ({
    frequency,
    phase: random() * Math.PI * 2,
    amplitude: EDGE_AMPLITUDE_MIN + random() * EDGE_AMPLITUDE_RANGE,
  }));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const angle = Math.atan2(dy, dx);

      let edge = 1;
      for (const h of harmonics) {
        edge -= h.amplitude * (1 + Math.sin(h.frequency * angle + h.phase)) / 2;
      }

      const t = Math.hypot(dx, dy) / radius / edge;
      if (t >= 1) continue;

      const falloff = 1 - smoothstep(SOFT_CORE, 1, t);
      const grain = GRAIN_MIN + (1 - GRAIN_MIN) * random();
      alpha[y * size + x] = Math.round(255 * falloff * grain);
    }
  }

  return alpha;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
