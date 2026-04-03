import {
  isFree,
  type AtlasQuery,
  type HullGeometry,
  type MotionConstraint,
  type OKLab,
  type Particle,
  type Vec3,
  type EdgeKey,
} from './types';
import { vec3Add, vec3Scale, vec3Dot } from './math';
import { computeBarycentric, interpolate, isValid, clampAndRenormalize } from './barycentric';

// ── Helpers ──────────────────────────────────────────────────────────────────

function oklabToVec3(lab: OKLab): Vec3 {
  return [lab.L, lab.a, lab.b];
}

function vec3ToOklab(v: Vec3): OKLab {
  return { L: v[0], a: v[1], b: v[2] };
}

function makeEdgeKey(i: number, j: number): EdgeKey {
  return i < j ? `${i}-${j}` : `${j}-${i}`;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSurfaceConstraint(
  atlas: AtlasQuery,
  hull: HullGeometry,
): MotionConstraint {
  return {
    // ── projectToTangent ────────────────────────────────────────────────────
    projectToTangent(force: Vec3, particle: Particle): Vec3 {
      // Pinned particles receive no force
      if (!isFree(particle)) {
        return [0, 0, 0];
      }

      const { u, v } = atlas.getFaceBasis(particle.faceIndex);

      // Project force onto the tangent plane spanned by u and v:
      //   F_parallel = dot(F, u)*u + dot(F, v)*v
      const fu = vec3Dot(force, u);
      const fv = vec3Dot(force, v);

      const uComponent = vec3Scale(u, fu);
      const vComponent = vec3Scale(v, fv);

      return vec3Add(uComponent, vComponent);
    },

    // ── applyDisplacement ───────────────────────────────────────────────────
    applyDisplacement(particle: Particle, displacement: Vec3): Particle {
      // Only free particles can move
      if (!isFree(particle)) {
        return particle;
      }

      const { faceIndex, bary } = particle;

      // Get current face vertices
      const [v0, v1, v2] = atlas.getFaceVertices(faceIndex);

      // Current position in 3-space
      const currentPos = oklabToVec3(interpolate(bary, v0, v1, v2));

      // Apply displacement in 3-space
      const newPosVec = vec3Add(currentPos, displacement);
      const newPosOklab = vec3ToOklab(newPosVec);

      // Compute barycentric coords of new position in current face
      const newBary = computeBarycentric(newPosOklab, v0, v1, v2);

      if (isValid(newBary)) {
        // Still in the same face — simple update
        const newPosition = interpolate(newBary, v0, v1, v2);
        return {
          kind: 'free',
          position: newPosition,
          faceIndex,
          bary: newBary,
        };
      }

      // ── Edge crossing ───────────────────────────────────────────────────
      // Identify which vertex has a negative weight (the opposite vertex to
      // the crossed edge). The edge itself is formed by the other two vertices.
      const [i0, i1, i2] = hull.faces[faceIndex].vertexIndices;
      const vertexIndices: [number, number, number] = [i0, i1, i2];
      const weights = [newBary.w0, newBary.w1, newBary.w2];

      // Find the index of the most-negative weight
      let minWeightIdx = 0;
      for (let k = 1; k < 3; k++) {
        if (weights[k] < weights[minWeightIdx]) {
          minWeightIdx = k;
        }
      }

      // The crossed edge is the edge opposite to vertex minWeightIdx,
      // i.e., formed by the other two vertex indices.
      const edgeVertices = vertexIndices.filter((_, k) => k !== minWeightIdx) as [number, number];
      const edgeKey = makeEdgeKey(edgeVertices[0], edgeVertices[1]);

      // Look up adjacent face
      const adjacentFaceIndex = atlas.getAdjacentFace(faceIndex, edgeKey);

      if (adjacentFaceIndex !== null) {
        // Recompute barycentric in the new face
        const [nv0, nv1, nv2] = atlas.getFaceVertices(adjacentFaceIndex);
        const newFaceBary = computeBarycentric(newPosOklab, nv0, nv1, nv2);

        // Clamp to keep the particle on the mesh (handles overshooting)
        const clampedBary = isValid(newFaceBary)
          ? newFaceBary
          : clampAndRenormalize(newFaceBary);

        const newPosition = interpolate(clampedBary, nv0, nv1, nv2);
        return {
          kind: 'free',
          position: newPosition,
          faceIndex: adjacentFaceIndex,
          bary: clampedBary,
        };
      }

      // ── Boundary: no adjacent face — clamp onto current edge ───────────
      const clampedBary = clampAndRenormalize(newBary);
      const newPosition = interpolate(clampedBary, v0, v1, v2);
      return {
        kind: 'free',
        position: newPosition,
        faceIndex,
        bary: clampedBary,
      };
    },
  };
}
