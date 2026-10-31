import { describe, expect, it } from 'vitest';
import {
  createDissolveField,
  createSettleField,
  createValueNoise,
  equalizeField,
  writeFieldAlpha,
} from './soot-field';

const SIZE = 32;
const seeded = (seed = 1): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};
const alphaOf = (rgba: Uint8ClampedArray): number[] => Array.from(rgba.filter((_, i) => i % 4 === 3));

describe('createValueNoise', () => {
  it('stays within 0..1', () => {
    const noise = createValueNoise(SIZE, 4, seeded());
    expect(Math.min(...noise)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...noise)).toBeLessThanOrEqual(1);
  });
});

describe('createDissolveField', () => {
  it('dissolves around erased areas before untouched ones', () => {
    const erased = new Uint8ClampedArray(SIZE * SIZE);
    erased.fill(255, 0, (SIZE * SIZE) / 2); // top half erased
    const field = createDissolveField(SIZE, erased, 4, () => 0.5);
    expect(field[0]).toBeLessThan(field[SIZE * SIZE - 1] ?? 0);
  });
});

describe('createSettleField', () => {
  it('covers the edges before the centre', () => {
    const field = createSettleField(SIZE, 4, () => 0.5);
    const centre = (SIZE / 2) * SIZE + SIZE / 2;
    expect(field[0]).toBeLessThan(field[centre] ?? 0);
  });
});

describe('equalizeField', () => {
  it('spreads bunched values evenly and keeps their order', () => {
    const random = seeded(7);
    const field = new Float32Array(4096).map(() => 0.45 + 0.1 * random());
    const before = Array.from(field);
    equalizeField(field);

    const coverage = (level: number): number => field.filter((v) => v < level).length / field.length;
    expect(coverage(0.25)).toBeCloseTo(0.25, 1);
    expect(coverage(0.5)).toBeCloseTo(0.5, 1);
    expect(coverage(0.75)).toBeCloseTo(0.75, 1);

    const lowest = before.indexOf(Math.min(...before));
    const highest = before.indexOf(Math.max(...before));
    expect(field[lowest]).toBeLessThan(field[highest] ?? 0);
  });

  it('maps a flat field to 0.5', () => {
    expect(Array.from(equalizeField(new Float32Array([0.3, 0.3])))).toEqual([0.5, 0.5]);
  });
});

describe('writeFieldAlpha', () => {
  const field = new Float32Array([0, 0.25, 0.5, 1]);

  it('covers nothing at level 0', () => {
    const rgba = new Uint8ClampedArray(16);
    writeFieldAlpha(field, 0, 0.1, rgba);
    expect(alphaOf(rgba)).toEqual([0, 0, 0, 0]);
  });

  it('covers values below the level, with a soft edge', () => {
    const rgba = new Uint8ClampedArray(16);
    writeFieldAlpha(field, 0.55, 0.1, rgba);
    expect(alphaOf(rgba)).toEqual([255, 255, 128, 0]);
  });

  it('covers everything once the level passes 1 + softness', () => {
    const rgba = new Uint8ClampedArray(16);
    writeFieldAlpha(field, 1.1, 0.1, rgba);
    expect(alphaOf(rgba)).toEqual([255, 255, 255, 255]);
  });
});
