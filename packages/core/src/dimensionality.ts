import type { OKLab } from './types';
import { svd } from './svd';

export interface DimensionalityResult {
  dimension: number;
  singularValues: number[];
  principalAxes: number[][];
}

/**
 * Detects the intrinsic dimensionality of a set of seed positions in OKLab
 * space using SVD of the mean-centered design matrix (Section 3.1).
 *
 * - dimension 0: all seeds coincide (σ₁ < machine epsilon)
 * - dimension 1: seeds are collinear
 * - dimension 2: seeds are coplanar (but not collinear)
 * - dimension 3: seeds span full 3D space
 */
export function detectDimensionality(seeds: OKLab[]): DimensionalityResult {
  const n = seeds.length;

  // 1. Compute mean
  let meanL = 0, meanA = 0, meanB = 0;
  for (const s of seeds) {
    meanL += s.L;
    meanA += s.a;
    meanB += s.b;
  }
  meanL /= n;
  meanA /= n;
  meanB /= n;

  // 2 & 3. Build N×3 mean-centered design matrix
  const A: number[][] = seeds.map(s => [
    s.L - meanL,
    s.a - meanA,
    s.b - meanB,
  ]);

  // 4. SVD — S is sorted descending
  const { S, V } = svd(A);

  // 5 & 6 & 7. Threshold and count significant singular values
  const sigma1 = S[0] ?? 0;
  const MACHINE_EPS = 1e-10;

  let dimension: number;
  if (sigma1 < MACHINE_EPS) {
    dimension = 0;
  } else {
    const tau = 1e-4 * sigma1;
    dimension = S.filter(sv => sv >= tau).length;
  }

  // 8. principalAxes = columns of V (each column is a principal axis)
  // V is n×k (3×k), columns are the right singular vectors
  const principalAxes: number[][] = Array.from(
    { length: V[0].length },
    (_, col) => V.map(row => row[col]),
  );

  return {
    dimension,
    singularValues: S,
    principalAxes,
  };
}
