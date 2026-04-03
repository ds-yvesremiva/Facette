import { isFree, type OKLab, type Vec3, type Particle, type MotionConstraint } from './types';
import { vec3Sub, vec3Dot, vec3Scale, vec3Normalize, vec3Norm } from './math';

function oklabToVec3(c: OKLab): Vec3 {
  return [c.L, c.a, c.b];
}

export function createLineConstraint(start: OKLab, end: OKLab): MotionConstraint {
  const segVec: Vec3 = vec3Sub(oklabToVec3(end), oklabToVec3(start));
  const segLen: number = vec3Norm(segVec);
  const d: Vec3 = vec3Normalize(segVec);

  return {
    projectToTangent(force: Vec3, particle: Particle): Vec3 {
      if (!isFree(particle)) {
        return [0, 0, 0];
      }
      // Project force onto d: (d · force) * d
      const scalar = vec3Dot(force, d);
      return vec3Scale(d, scalar);
    },

    applyDisplacement(particle: Particle, displacement: Vec3): Particle {
      if (!isFree(particle)) {
        return particle;
      }

      // free-1d: convert displacement to Δt along segment
      const deltaT = vec3Dot(displacement, d) / segLen;
      const newT = Math.min(1, Math.max(0, particle.t + deltaT));
      const newPosition: OKLab = {
        L: start.L + newT * (end.L - start.L),
        a: start.a + newT * (end.a - start.a),
        b: start.b + newT * (end.b - start.b),
      };
      return { kind: 'free-1d', position: newPosition, t: newT };
    },
  };
}
