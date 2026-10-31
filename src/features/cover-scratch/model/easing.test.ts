import { describe, expect, it } from 'vitest';
import { easeInOutCubic } from './easing';

describe('easeInOutCubic', () => {
  it('maps 0 to 0, 0.5 to 0.5 and 1 to 1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });
});
