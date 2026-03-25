import { describe, it, expect } from 'vitest';
import { svd } from './svd';

function reconstructAndCompare(A: number[][], tolerance: number) {
  const { U, S, V } = svd(A);
  const m = A.length;
  const n = A[0].length;
  const k = S.length;

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let r = 0; r < k; r++) {
        sum += U[i][r] * S[r] * V[j][r];
      }
      expect(sum).toBeCloseTo(A[i][j], tolerance);
    }
  }
}

describe('SVD', () => {
  it('reconstructs a 3×3 matrix', () => {
    reconstructAndCompare([[1, 2, 3], [4, 5, 6], [7, 8, 10]], 6);
  });

  it('returns sorted singular values (descending)', () => {
    const { S } = svd([[1, 0, 0], [0, 3, 0], [0, 0, 2]]);
    expect(S[0]).toBeGreaterThanOrEqual(S[1]);
    expect(S[1]).toBeGreaterThanOrEqual(S[2]);
    // Should be 3, 2, 1
    expect(S[0]).toBeCloseTo(3, 6);
    expect(S[1]).toBeCloseTo(2, 6);
    expect(S[2]).toBeCloseTo(1, 6);
  });

  it('handles rank-deficient matrix (rank 2)', () => {
    const A = [[1, 0, 0], [0, 1, 0], [1, 1, 0]];
    const { S } = svd(A);
    // Third singular value should be approximately 0
    expect(S[S.length - 1]).toBeCloseTo(0, 6);
    // But first two should be non-zero
    expect(S[0]).toBeGreaterThan(0.1);
  });

  it('handles 2×3 matrix', () => {
    reconstructAndCompare([[1, 2, 3], [4, 5, 6]], 6);
  });

  it('handles 1×3 matrix', () => {
    const { S } = svd([[3, 4, 0]]);
    expect(S[0]).toBeCloseTo(5, 6);
  });

  it('handles 5×3 matrix (more rows than cols)', () => {
    reconstructAndCompare([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
      [1, 0, 1],
    ], 5);
  });

  it('handles identity matrix', () => {
    const { S } = svd([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    expect(S[0]).toBeCloseTo(1, 6);
    expect(S[1]).toBeCloseTo(1, 6);
    expect(S[2]).toBeCloseTo(1, 6);
  });

  it('U columns are orthonormal for full-rank matrix', () => {
    const { U, S } = svd([[1, 2, 3], [4, 5, 6], [7, 8, 10]]);
    // Check orthogonality of non-zero singular value columns
    const k = S.filter(s => s > 1e-8).length;
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        let dot = 0;
        for (let r = 0; r < U.length; r++) {
          dot += U[r][i] * U[r][j];
        }
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 5);
      }
    }
  });
});
