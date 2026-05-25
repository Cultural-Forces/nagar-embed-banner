import type { ErasureGrid, RevealState } from '../shared/types';
import { countErased } from './erasure-grid';

export function computeReveal(grid: ErasureGrid, threshold: number): RevealState {
  const total = grid.size * grid.size;
  const erased = countErased(grid);
  const ratio = total === 0 ? 0 : erased / total;
  return {
    ratio,
    thresholdReached: ratio >= threshold,
  };
}
