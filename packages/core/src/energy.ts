import type { ForceComputer, GamutChecker, OKLab, Particle, Vec3, WarpTransform } from './types';
import { oklabToLinearRgb } from './color-conversion';
import { vec3Add, vec3Scale, vec3Sub, vec3Norm } from './math';

/** Convert an OKLab value to a Vec3 tuple [L, a, b]. */
function oklabToVec3(pos: OKLab): Vec3 {
  return [pos.L, pos.a, pos.b];
}

/**
 * Compute the scalar gamut penalty energy for a single particle position.
 * P = Σ_c { c² if c < 0,  (c−1)² if c > 1,  0 otherwise }
 */
function gamutPenaltyEnergy(pos: OKLab): number {
  const rgb = oklabToLinearRgb(pos);
  let e = 0;
  for (const c of [rgb.r, rgb.g, rgb.b]) {
    if (c < 0) e += c * c;
    else if (c > 1) e += (c - 1) * (c - 1);
  }
  return e;
}

/**
 * Creates a ForceComputer that computes Riesz repulsion energy/forces
 * in warped space, with an optional quadratic out-of-gamut penalty.
 */
export function createForceComputer(
  warp: WarpTransform,
  gamut: GamutChecker,
): ForceComputer {
  return {
    computeForcesAndEnergy(
      particles: readonly Particle[],
      p: number,
      kappa: number,
    ): { forces: Vec3[]; energy: number } {
      const n = particles.length;

      // Step 1: map all positions to warped coordinates as Vec3
      const warpedVecs: Vec3[] = particles.map(pt =>
        oklabToVec3(warp.toWarped(pt.position)),
      );

      // Step 2 & 3: pairwise warped distances + repulsion energy
      // Also accumulate per-particle repulsion gradients in warped space.
      const gradWarpedRep: Vec3[] = Array.from({ length: n }, () => [0, 0, 0] as Vec3);
      let eRep = 0;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          // diff = wi - wj
          const diff: Vec3 = vec3Sub(warpedVecs[i], warpedVecs[j]);
          const rawDist = vec3Norm(diff);
          const dij = Math.max(rawDist, 1e-10);

          // Repulsion energy: 1/d^p
          eRep += Math.pow(dij, -p);

          // Actual energy gradient: ∂E/∂wi = -p · d^{-(p+2)} · (wi - wj)
          // grad_i += -coeff * (wi - wj)  = -coeff * diff
          // grad_j += -coeff * (wj - wi)  = +coeff * diff
          const coeff = p * Math.pow(dij, -(p + 2));
          gradWarpedRep[i] = vec3Add(gradWarpedRep[i], vec3Scale(diff, -coeff));
          gradWarpedRep[j] = vec3Add(gradWarpedRep[j], vec3Scale(diff, coeff));
        }
      }

      // Steps 5–8: pull back repulsion gradient and add gamut gradient → total force
      const forces: Vec3[] = [];
      let eGamut = 0;

      for (let i = 0; i < n; i++) {
        const pos = particles[i].position;

        // Step 5: pull back repulsion gradient to OKLab
        const gradOklabRep = warp.pullBackGradient(pos, gradWarpedRep[i]);

        // Step 6: gamut penalty gradient
        const gradGamut = gamut.penaltyGradient(pos);

        // Step 7: gamut penalty energy
        eGamut += gamutPenaltyEnergy(pos);

        // Step 8: total force = -(grad_rep + kappa * grad_gamut)
        const totalGrad = vec3Add(gradOklabRep, vec3Scale(gradGamut, kappa));
        forces.push(vec3Scale(totalGrad, -1));
      }

      // Step 9: total energy
      const energy = eRep + kappa * eGamut;

      return { forces, energy };
    },
  };
}
