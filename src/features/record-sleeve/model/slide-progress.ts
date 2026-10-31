/**
 * How far the record is out of the sleeve for the sleeve's place in the
 * viewport, 0..1. 0 while the sleeve top is at or below the bottom edge,
 * 1 once the sleeve middle is up at `endRatio` of the viewport height; eased
 * in between. Near the end of the page the sleeve may never get that high:
 * then the run ends at `highestTop`, the top it has at the furthest scroll,
 * so the record still comes all the way out. Depends only on position, so
 * scrolling back up slides it in.
 */
export function slideProgress(
  top: number,
  height: number,
  viewportHeight: number,
  endRatio: number,
  highestTop: number,
): number {
  const start = viewportHeight;
  const end = Math.max(viewportHeight * endRatio - height / 2, highestTop);
  // the page does not scroll the sleeve into view: show the record out
  if (start <= end) return 1;
  const progress = Math.min(1, Math.max(0, (start - top) / (start - end)));
  return progress * progress * (3 - 2 * progress);
}
