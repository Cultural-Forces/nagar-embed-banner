/**
 * The top the sleeve has when the record is all the way out: its middle up
 * at `endRatio` of the viewport height. Near the end of the page the sleeve
 * may never get that high; then it is `highestTop`, the top it has at the
 * furthest scroll, so the record still comes all the way out.
 */
function slideEndTop(height: number, viewportHeight: number, endRatio: number, highestTop: number): number {
  return Math.max(viewportHeight * endRatio - height / 2, highestTop);
}

/**
 * How far the record is out of the sleeve for the sleeve's place in the
 * viewport, 0..1. 0 while the sleeve top is at or below the bottom edge,
 * 1 once it reaches `slideEndTop`; eased in between (smoothstep). Depends
 * only on position, so scrolling back up slides it in.
 */
export function slideProgress(
  top: number,
  height: number,
  viewportHeight: number,
  endRatio: number,
  highestTop: number,
): number {
  const start = viewportHeight;
  const end = slideEndTop(height, viewportHeight, endRatio, highestTop);
  // the page does not scroll the sleeve into view: show the record out
  if (start <= end) return 1;
  const progress = Math.min(1, Math.max(0, (start - top) / (start - end)));
  return progress * progress * (3 - 2 * progress);
}

/**
 * The same run for a CSS view timeline: where the record is all the way out,
 * as a share of the timeline's `cover` range (0 with the sleeve top at the
 * bottom edge of the viewport, 1 with its bottom at the top edge). `null`
 * when the page does not scroll the sleeve into view, so the record stays out.
 */
export function slideEndFraction(
  height: number,
  viewportHeight: number,
  endRatio: number,
  highestTop: number,
): number | null {
  const end = slideEndTop(height, viewportHeight, endRatio, highestTop);
  if (viewportHeight <= end || viewportHeight + height <= 0) return null;
  return Math.min(1, (viewportHeight - end) / (viewportHeight + height));
}
