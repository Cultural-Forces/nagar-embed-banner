import type { Point } from '../shared/types';

export function sampleLine(from: Point, to: Point, step: number): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return [to];
  }

  const safeStep = Math.max(step, 0.0001);
  const steps = Math.max(1, Math.ceil(distance / safeStep));
  const points: Point[] = new Array(steps);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points[i - 1] = { x: from.x + dx * t, y: from.y + dy * t };
  }

  return points;
}
