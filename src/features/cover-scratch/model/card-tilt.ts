export type CardTilt = {
  /** Degrees around the horizontal axis: positive tips the top edge away. */
  readonly rotateX: number;
  /** Degrees around the vertical axis: positive tips the right edge away. */
  readonly rotateY: number;
};

export type PointerOffset = {
  /** -1 at the left edge, 0 in the middle, 1 at the right edge. */
  readonly x: number;
  /** -1 at the top edge, 0 in the middle, 1 at the bottom edge. */
  readonly y: number;
};

/** Where the pointer at `x`, `y` (0..1 across the card, may fall outside) is from the middle, kept within the card. */
export function pointerOffset(x: number, y: number): PointerOffset {
  const clamp = (value: number): number => Math.min(1, Math.max(0, value));
  return {
    x: (clamp(x) - 0.5) * 2,
    y: (clamp(y) - 0.5) * 2,
  };
}

/**
 * How far the card turns for the pointer at `x`, `y` (0..1 across it, may
 * fall outside): the edge under the pointer sinks away from the person, as if
 * pressed, up to `maxDeg` at the edge itself.
 */
export function tiltForPointer(x: number, y: number, maxDeg: number): CardTilt {
  const offset = pointerOffset(x, y);
  return {
    rotateX: -offset.y * maxDeg,
    rotateY: offset.x * maxDeg,
  };
}
