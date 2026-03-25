import { describe, it, expect } from 'vitest';
import { createSurfaceConstraint } from './surface-navigation';
import { buildAtlas } from './atlas';
import type { HullGeometry, Particle, EdgeKey } from './types';

function makeEdgeKey(i: number, j: number): EdgeKey {
  return i < j ? `${i}-${j}` : `${j}-${i}`;
}

describe('SurfaceConstraint', () => {
  const adjacency = new Map<EdgeKey, [number, number]>();
  adjacency.set(makeEdgeKey(0, 1), [0, 1]);
  adjacency.set(makeEdgeKey(0, 2), [0, 2]);
  adjacency.set(makeEdgeKey(1, 2), [0, 3]);
  adjacency.set(makeEdgeKey(0, 3), [1, 2]);
  adjacency.set(makeEdgeKey(1, 3), [1, 3]);
  adjacency.set(makeEdgeKey(2, 3), [2, 3]);

  const hull: HullGeometry = {
    kind: 'hull',
    vertices: [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
      { L: 0, a: 0, b: 1 },
    ],
    faces: [
      { vertexIndices: [0, 1, 2] },
      { vertexIndices: [0, 1, 3] },
      { vertexIndices: [0, 2, 3] },
      { vertexIndices: [1, 2, 3] },
    ],
    adjacency,
  };

  const atlas = buildAtlas(hull);
  const constraint = createSurfaceConstraint(atlas, hull);

  describe('projectToTangent', () => {
    it('removes normal component from force', () => {
      const particle: Particle = {
        kind: 'free', position: { L: 1/3, a: 1/3, b: 0 },
        faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 },
      };
      // Face 0 is in the L-a plane (b=0), so normal is along b
      const force: [number, number, number] = [0, 0, 1]; // pure normal
      const projected = constraint.projectToTangent(force, particle);
      const mag = Math.sqrt(projected[0]**2 + projected[1]**2 + projected[2]**2);
      expect(mag).toBeCloseTo(0, 4);
    });

    it('preserves in-plane force', () => {
      const particle: Particle = {
        kind: 'free', position: { L: 1/3, a: 1/3, b: 0 },
        faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 },
      };
      const force: [number, number, number] = [1, 0, 0]; // in L-a plane
      const projected = constraint.projectToTangent(force, particle);
      expect(projected[0]).toBeCloseTo(1, 4);
      // Some a component possible due to projection basis, but b should be ~0
      expect(projected[2]).toBeCloseTo(0, 4);
    });

    it('returns zero for pinned particles', () => {
      const particle: Particle = { kind: 'pinned-vertex', position: { L: 0, a: 0, b: 0 }, vertexIndex: 0 };
      const projected = constraint.projectToTangent([1, 1, 1], particle);
      expect(projected).toEqual([0, 0, 0]);
    });
  });

  describe('applyDisplacement', () => {
    it('moves particle within same face for small displacement', () => {
      const particle: Particle = {
        kind: 'free', position: { L: 1/3, a: 1/3, b: 0 },
        faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 },
      };
      const disp: [number, number, number] = [0.01, 0, 0];
      const result = constraint.applyDisplacement(particle, disp);
      expect(result.kind).toBe('free');
      if (result.kind === 'free') {
        expect(result.faceIndex).toBe(0);
      }
    });

    it('does not move pinned particles', () => {
      const particle: Particle = {
        kind: 'pinned-boundary', position: { L: 0.5, a: 0.5, b: 0 },
        faceIndex: 0, bary: { w0: 0, w1: 0.5, w2: 0.5 },
      };
      const result = constraint.applyDisplacement(particle, [1, 1, 1]);
      expect(result.kind).toBe('pinned-boundary');
      expect(result.position).toEqual(particle.position);
    });

    it('particle position stays on hull surface', () => {
      const particle: Particle = {
        kind: 'free', position: { L: 1/3, a: 1/3, b: 0 },
        faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 },
      };
      const disp: [number, number, number] = [0.05, -0.02, 0.01];
      const result = constraint.applyDisplacement(particle, disp);
      if (result.kind === 'free') {
        // Verify barycentric coords are valid
        expect(result.bary.w0).toBeGreaterThanOrEqual(-1e-6);
        expect(result.bary.w1).toBeGreaterThanOrEqual(-1e-6);
        expect(result.bary.w2).toBeGreaterThanOrEqual(-1e-6);
        expect(result.bary.w0 + result.bary.w1 + result.bary.w2).toBeCloseTo(1, 4);
      }
    });
  });
});
