import { describe, expect, it } from 'vitest';
import { easeInOutCubic, settleLevel } from './settle-level';

describe('settleLevel', () => {
  it('is 0 while the cover top is in view', () => {
    expect(settleLevel(120, 400, 0.4, 0.7)).toBe(0);
    expect(settleLevel(0, 400, 0.4, 0.7)).toBe(0);
  });

  it('grows as the cover scrolls out above the viewport', () => {
    const a = settleLevel(-50, 400, 0.4, 0.7);
    const b = settleLevel(-150, 400, 0.4, 0.7);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });

  it('stops at the max level', () => {
    expect(settleLevel(-280, 400, 0.4, 0.7)).toBeCloseTo(0.4);
    expect(settleLevel(-2000, 400, 0.4, 0.7)).toBeCloseTo(0.4);
  });

  it('returns 0 for an element with no height', () => {
    expect(settleLevel(-100, 0, 0.4, 0.7)).toBe(0);
  });
});

describe('easeInOutCubic', () => {
  it('maps 0 to 0, 0.5 to 0.5 and 1 to 1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });
});
