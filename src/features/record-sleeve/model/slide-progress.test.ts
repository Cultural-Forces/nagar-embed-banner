import { describe, expect, it } from 'vitest';
import { slideProgress } from './slide-progress';

// a long page: the sleeve can scroll far above the end line
const FAR = -10_000;

describe('slideProgress', () => {
  it('is 0 while the sleeve is below the viewport', () => {
    expect(slideProgress(900, 300, 800, 0.45, FAR)).toBe(0);
    expect(slideProgress(800, 300, 800, 0.45, FAR)).toBe(0);
  });

  it('grows as the sleeve comes up', () => {
    const a = slideProgress(700, 300, 800, 0.45, FAR);
    const b = slideProgress(500, 300, 800, 0.45, FAR);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });

  it('is 1 once the sleeve middle reaches the end line and stays there', () => {
    // end line at 360 px, so the sleeve top is at 360 - 150
    expect(slideProgress(210, 300, 800, 0.45, FAR)).toBeCloseTo(1);
    expect(slideProgress(-400, 300, 800, 0.45, FAR)).toBe(1);
  });

  it('ends where the page stops scrolling when that is below the end line', () => {
    expect(slideProgress(320, 300, 800, 0.45, 320)).toBe(1);
    expect(slideProgress(560, 300, 800, 0.45, 320)).toBeCloseTo(0.5);
  });

  it('shows the record out when the page cannot bring the sleeve up', () => {
    expect(slideProgress(900, 300, 800, 0.45, 900)).toBe(1);
  });
});
