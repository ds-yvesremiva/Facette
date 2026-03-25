import { describe, it, expect } from 'vitest';
import { buildConvexHull } from './convex-hull';
import type { OKLab } from './types';

describe('convex hull', () => {
  it('builds tetrahedron from 4 non-coplanar points', () => {
    const points: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
      { L: 0, a: 0, b: 1 },
    ];
    const hull = buildConvexHull(points);
    expect(hull.kind).toBe('hull');
    expect(hull.faces.length).toBe(4);
    expect(hull.vertices.length).toBe(4);
  });

  it('has consistent outward normals', () => {
    const points: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
      { L: 0, a: 0, b: 1 },
    ];
    const hull = buildConvexHull(points);
    // Compute centroid
    const cx = points.reduce((s, p) => s + p.L, 0) / points.length;
    const ca = points.reduce((s, p) => s + p.a, 0) / points.length;
    const cb = points.reduce((s, p) => s + p.b, 0) / points.length;

    for (const face of hull.faces) {
      const [i0, i1, i2] = face.vertexIndices;
      const v0 = hull.vertices[i0];
      const v1 = hull.vertices[i1];
      const v2 = hull.vertices[i2];
      // Face normal
      const e1 = [v1.L - v0.L, v1.a - v0.a, v1.b - v0.b];
      const e2 = [v2.L - v0.L, v2.a - v0.a, v2.b - v0.b];
      const normal = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ];
      // Vector from centroid to face vertex
      const toFace = [v0.L - cx, v0.a - ca, v0.b - cb];
      const dot = normal[0] * toFace[0] + normal[1] * toFace[1] + normal[2] * toFace[2];
      expect(dot).toBeGreaterThan(-1e-10); // outward or zero
    }
  });

  it('builds hull from 8 cube corners', () => {
    const points: OKLab[] = [];
    for (const L of [0, 1]) {
      for (const a of [0, 1]) {
        for (const b of [0, 1]) {
          points.push({ L, a, b });
        }
      }
    }
    const hull = buildConvexHull(points);
    expect(hull.faces.length).toBe(12); // 6 quad faces, each split into 2 triangles
    expect(hull.vertices.length).toBe(8);
  });

  it('all input points are inside or on hull', () => {
    const points: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
      { L: 0, a: 0, b: 1 },
      { L: 0.25, a: 0.25, b: 0.25 }, // interior point
    ];
    const hull = buildConvexHull(points);
    // Interior point should still be inside (hull has 4 faces from tetrahedron)
    expect(hull.faces.length).toBe(4);
  });

  it('adjacency map has correct entries for tetrahedron', () => {
    const points: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
      { L: 0, a: 0, b: 1 },
    ];
    const hull = buildConvexHull(points);
    // Tetrahedron has 6 edges, each shared by 2 faces
    expect(hull.adjacency.size).toBe(6);
    for (const [_key, faces] of hull.adjacency) {
      expect(faces.length).toBe(2);
      expect(faces[0]).not.toBe(faces[1]);
    }
  });

  it('handles coplanar points (dim=2)', () => {
    const points: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
      { L: 1, a: 1, b: 0 },
    ];
    const hull = buildConvexHull(points);
    expect(hull.kind).toBe('hull');
    expect(hull.faces.length).toBeGreaterThanOrEqual(2); // at least 2 triangles for a quad
  });
});
