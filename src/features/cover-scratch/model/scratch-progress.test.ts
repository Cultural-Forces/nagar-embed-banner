import { describe, expect, it } from 'vitest';
import { computeErasedRatio } from './scratch-progress';

const rgba = (...alphas: number[]): Uint8ClampedArray =>
  new Uint8ClampedArray(alphas.flatMap((a) => [255, 255, 255, a]));

describe('computeErasedRatio', () => {
  it('returns 0 for empty data', () => {
    expect(computeErasedRatio(new Uint8ClampedArray(0), 128)).toBe(0);
  });

  it('counts only pixels whose alpha reached the cutoff', () => {
    expect(computeErasedRatio(rgba(0, 127, 128, 255), 128)).toBe(0.5);
  });

  it('ignores color channels', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 200]);
    expect(computeErasedRatio(data, 128)).toBe(0.5);
  });
});
