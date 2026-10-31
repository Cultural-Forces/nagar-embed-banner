/**
 * How much soot settles back on the revealed cover for its scroll position.
 * 0 while the cover is fully below the top of the viewport, growing smoothly
 * to `maxLevel` once `range` of its height has scrolled out above the top.
 * Depends only on position, so scrolling back up clears it again.
 */
export function settleLevel(top: number, height: number, maxLevel: number, range: number): number {
  if (height <= 0 || range <= 0) return 0;
  const progress = Math.min(1, Math.max(0, -top / (height * range)));
  return maxLevel * progress * progress * (3 - 2 * progress);
}

/** Ease for the reveal dissolve: slow start, fast middle, soft end. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
