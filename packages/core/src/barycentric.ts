import type { OKLab, Barycentric } from './types';
import type { Vec3 } from './types';
import { vec3Sub, vec3Dot } from './math';

function oklabToVec3(c: OKLab): Vec3 {
  return [c.L, c.a, c.b];
}

/**
 * Compute barycentric coordinates of point p with respect to triangle (v0, v1, v2)
 * using Cramer's rule on the projection onto the triangle plane.
 *
 * We solve: p - v0 = w1*(v1 - v0) + w2*(v2 - v0)
 * then w0 = 1 - w1 - w2.
 *
 * The system is 3 equations in 2 unknowns; we solve the least-squares normal
 * equations via Cramer's rule on the 2x2 Gram matrix.
 */
export function computeBarycentric(
  p: OKLab,
  v0: OKLab,
  v1: OKLab,
  v2: OKLab,
): Barycentric {
  const pv  = oklabToVec3(p);
  const v0v = oklabToVec3(v0);
  const v1v = oklabToVec3(v1);
  const v2v = oklabToVec3(v2);

  // Edge vectors from v0
  const e1 = vec3Sub(v1v, v0v); // v1 - v0
  const e2 = vec3Sub(v2v, v0v); // v2 - v0
  const d  = vec3Sub(pv,  v0v); // p  - v0

  // Gram matrix entries
  const d11 = vec3Dot(e1, e1);
  const d12 = vec3Dot(e1, e2);
  const d22 = vec3Dot(e2, e2);

  // Right-hand side projections
  const r1 = vec3Dot(d, e1);
  const r2 = vec3Dot(d, e2);

  // Determinant of Gram matrix
  const det = d11 * d22 - d12 * d12;

  let w1: number;
  let w2: number;

  if (Math.abs(det) < 1e-14) {
    // Degenerate triangle: fall back to equal weights
    w1 = 1 / 3;
    w2 = 1 / 3;
  } else {
    // Cramer's rule
    w1 = (r1 * d22 - r2 * d12) / det;
    w2 = (r2 * d11 - r1 * d12) / det;
  }

  const w0 = 1 - w1 - w2;

  return { w0, w1, w2 };
}

/**
 * Reconstruct a point from barycentric coordinates:
 *   result = w0*v0 + w1*v1 + w2*v2
 */
export function interpolate(
  bary: Barycentric,
  v0: OKLab,
  v1: OKLab,
  v2: OKLab,
): OKLab {
  return {
    L: bary.w0 * v0.L + bary.w1 * v1.L + bary.w2 * v2.L,
    a: bary.w0 * v0.a + bary.w1 * v1.a + bary.w2 * v2.a,
    b: bary.w0 * v0.b + bary.w1 * v1.b + bary.w2 * v2.b,
  };
}

/**
 * Return true if all weights are >= -1e-10 (inside or on triangle boundary)
 * and the weights sum to 1 within 1e-6.
 */
export function isValid(bary: Barycentric): boolean {
  const { w0, w1, w2 } = bary;
  const TOLERANCE = -1e-10;
  const SUM_TOLERANCE = 1e-6;
  if (w0 < TOLERANCE || w1 < TOLERANCE || w2 < TOLERANCE) return false;
  if (Math.abs(w0 + w1 + w2 - 1) > SUM_TOLERANCE) return false;
  return true;
}

/**
 * Clamp any negative weights to 0, then renormalize so the weights sum to 1.
 */
export function clampAndRenormalize(bary: Barycentric): Barycentric {
  const w0 = Math.max(0, bary.w0);
  const w1 = Math.max(0, bary.w1);
  const w2 = Math.max(0, bary.w2);
  const sum = w0 + w1 + w2;
  if (sum === 0) {
    // Pathological case: all weights were zero or negative
    return { w0: 1 / 3, w1: 1 / 3, w2: 1 / 3 };
  }
  return { w0: w0 / sum, w1: w1 / sum, w2: w2 / sum };
}
