import { describe, expect, it } from 'vitest';
import { createBrushAlpha } from './brush-alpha';

const SIZE = 64;
const at = (alpha: Uint8ClampedArray, x: number, y: number): number => alpha[y * SIZE + x] ?? -1;

describe('createBrushAlpha', () => {
  it('returns size * size values', () => {
    expect(createBrushAlpha(SIZE, () => 0.5)).toHaveLength(SIZE * SIZE);
  });

  it('is transparent in the corners and dense in the middle', () => {
    const alpha = createBrushAlpha(SIZE, () => 1);
    expect(at(alpha, 0, 0)).toBe(0);
    expect(at(alpha, SIZE - 1, SIZE - 1)).toBe(0);
    expect(at(alpha, SIZE / 2, SIZE / 2)).toBe(255);
  });

  it('fades towards the edge', () => {
    const alpha = createBrushAlpha(SIZE, () => 1);
    const middle = SIZE / 2;
    expect(at(alpha, middle + 20, middle)).toBeLessThan(at(alpha, middle + 10, middle));
  });

  it('adds grain from the random source', () => {
    let calls = 0;
    const alternating = (): number => (calls++ % 2 === 0 ? 0 : 1);
    const alpha = createBrushAlpha(SIZE, alternating);
    const middle = SIZE / 2;
    expect(at(alpha, middle, middle)).not.toBe(at(alpha, middle + 1, middle));
  });
});
