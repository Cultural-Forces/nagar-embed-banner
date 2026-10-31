/**
 * Share of pixels whose alpha reached `cutoff` in RGBA data from the mask.
 * The mask is opaque where the nagar is erased, so this is the erased share.
 */
export function computeErasedRatio(rgba: Uint8ClampedArray, cutoff: number): number {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;

  let erased = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if ((rgba[i] ?? 0) >= cutoff) erased++;
  }
  return erased / pixels;
}
