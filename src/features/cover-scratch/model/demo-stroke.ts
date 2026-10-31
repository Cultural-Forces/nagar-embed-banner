import type { Point } from '../shared/types';

/**
 * Path of the stroke that shows the move by itself: a loose wave across the
 * upper third, above the hint. The cover is red there (its bottom is black), so
 * the stroke visibly opens the picture. Points are 0..1 of the square.
 */
export function createDemoStroke(steps: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: 0.2 + 0.6 * t,
      y: 0.24 + 0.05 * Math.sin(t * Math.PI * 1.6),
    });
  }
  return points;
}
