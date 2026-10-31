import { describe, expect, it } from 'vitest';
import { pointerOffset, tiltForPointer } from './card-tilt';

describe('pointerOffset', () => {
  it('is 0 in the middle and ±1 at the edges', () => {
    expect(pointerOffset(0.5, 0.5)).toEqual({ x: 0, y: 0 });
    expect(pointerOffset(0, 1)).toEqual({ x: -1, y: 1 });
    expect(pointerOffset(1, 0)).toEqual({ x: 1, y: -1 });
  });

  it('stays within the card when the pointer is outside', () => {
    expect(pointerOffset(-0.2, 1.3)).toEqual({ x: -1, y: 1 });
  });
});

describe('tiltForPointer', () => {
  it('stays flat with the pointer in the middle', () => {
    const tilt = tiltForPointer(0.5, 0.5, 6);
    expect(tilt.rotateX).toBeCloseTo(0);
    expect(tilt.rotateY).toBeCloseTo(0);
  });

  it('sinks the edge under the pointer by the max angle', () => {
    expect(tiltForPointer(0.5, 0, 6).rotateX).toBeCloseTo(6);
    expect(tiltForPointer(0.5, 1, 6).rotateX).toBeCloseTo(-6);
    expect(tiltForPointer(0, 0.5, 6).rotateY).toBeCloseTo(-6);
    expect(tiltForPointer(1, 0.5, 6).rotateY).toBeCloseTo(6);
  });

  it('does not go past the max angle outside the card', () => {
    const tilt = tiltForPointer(1.4, -0.3, 6);
    expect(tilt.rotateX).toBeCloseTo(6);
    expect(tilt.rotateY).toBeCloseTo(6);
  });
});
