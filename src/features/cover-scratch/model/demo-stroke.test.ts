import { describe, expect, it } from 'vitest';
import { createDemoStroke } from './demo-stroke';

describe('createDemoStroke', () => {
  it('returns steps + 1 points going left to right', () => {
    const path = createDemoStroke(10);
    expect(path).toHaveLength(11);
    expect(path[0]?.x).toBeLessThan(path[10]?.x ?? 0);
  });

  it('stays in the upper third, above the centred hint', () => {
    for (const point of createDemoStroke(48)) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(1);
      expect(point.y).toBeLessThan(1 / 3);
    }
  });
});
