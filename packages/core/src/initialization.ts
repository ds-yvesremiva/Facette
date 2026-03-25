import type {
  Particle,
  OKLab,
  Barycentric,
  HullGeometry,
  LineGeometry,
  AtlasQuery,
  WarpTransform,
} from './types';
import { interpolate, computeBarycentric, clampAndRenormalize } from './barycentric';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function oklabDistSq(a: OKLab, b: OKLab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dL * dL + da * da + db * db;
}

/**
 * Compute the area of a triangle in OKLab space given three vertices.
 */
function triangleArea(p0: OKLab, p1: OKLab, p2: OKLab): number {
  // cross product of (p1-p0) and (p2-p0), then |cross|/2
  const e1L = p1.L - p0.L; const e1a = p1.a - p0.a; const e1b = p1.b - p0.b;
  const e2L = p2.L - p0.L; const e2a = p2.a - p0.a; const e2b = p2.b - p0.b;
  const cx = e1a * e2b - e1b * e2a;
  const cy = e1b * e2L - e1L * e2b;
  const cz = e1L * e2a - e1a * e2L;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

/**
 * Compute the subdivided warped area of a face by splitting it into 4
 * sub-triangles using the 3 edge midpoints, then transforming all 6 points
 * through warp.toWarped and summing the sub-triangle areas.
 */
function subdividedWarpedArea(
  v0: OKLab,
  v1: OKLab,
  v2: OKLab,
  warp: WarpTransform,
): number {
  // Compute edge midpoints in OKLab space
  const m01: OKLab = { L: (v0.L + v1.L) / 2, a: (v0.a + v1.a) / 2, b: (v0.b + v1.b) / 2 };
  const m12: OKLab = { L: (v1.L + v2.L) / 2, a: (v1.a + v2.a) / 2, b: (v1.b + v2.b) / 2 };
  const m02: OKLab = { L: (v0.L + v2.L) / 2, a: (v0.a + v2.a) / 2, b: (v0.b + v2.b) / 2 };

  // Warp all 6 points
  const w0   = warp.toWarped(v0);
  const w1   = warp.toWarped(v1);
  const w2   = warp.toWarped(v2);
  const wm01 = warp.toWarped(m01);
  const wm12 = warp.toWarped(m12);
  const wm02 = warp.toWarped(m02);

  // Sum areas of 4 sub-triangles in warped space
  return (
    triangleArea(w0,   wm01, wm02) +
    triangleArea(wm01, w1,   wm12) +
    triangleArea(wm02, wm12, w2  ) +
    triangleArea(wm01, wm12, wm02)
  );
}

/**
 * Count how many particles are currently on a given face.
 * Pinned-vertex particles are considered to be on all faces that include
 * their vertex, but for simplicity we count particles whose faceIndex matches.
 * Pinned-vertex particles are not counted per-face (they are corner anchors).
 */
function countParticlesOnFace(
  particles: Particle[],
  faceIndex: number,
  hull: HullGeometry,
): number {
  let count = 0;
  for (const p of particles) {
    if (p.kind === 'free' && p.faceIndex === faceIndex) {
      count++;
    } else if (p.kind === 'pinned-boundary' && p.faceIndex === faceIndex) {
      count++;
    } else if (p.kind === 'pinned-vertex') {
      // Count the pinned vertex as on the face if the vertex is one of the face's vertices
      const face = hull.faces[faceIndex];
      if (face.vertexIndices.includes(p.vertexIndex)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Generate a 5×5 grid of barycentric coordinates inside the triangle
 * (staying away from degenerate edges). Skips samples outside the triangle.
 */
function generate5x5BaryGrid(): Barycentric[] {
  const samples: Barycentric[] = [];
  const N = 5;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N - i; j++) {
      const w0 = i / N;
      const w1 = j / N;
      const w2 = 1 - w0 - w1;
      if (w2 < -1e-9) continue;
      samples.push({ w0, w1, w2: Math.max(0, w2) });
    }
  }
  return samples;
}

// ---------------------------------------------------------------------------
// 1D initialization
// ---------------------------------------------------------------------------

/**
 * Place N particles along a line segment. Seeds (pinned-endpoint particles)
 * are preserved as-is. Remaining N - seeds.length particles are placed at
 * equal parametric intervals as free-1d particles.
 *
 * With 2 endpoint seeds at t=0 and t=1, N-1 intervals are created and
 * free particles are placed at interior positions t = i/(N-1).
 */
export function initializeParticles1D(
  seeds: Particle[],
  line: LineGeometry,
  n: number,
): Particle[] {
  const result: Particle[] = [...seeds];
  const needed = n - seeds.length;
  if (needed <= 0) return result;

  // With endpoints at t=0 and t=1, there are N-1 intervals total.
  // Interior t values are i/(N-1) for i = 1 .. N-2.
  // This gives n-2 free particles placed between the two endpoints.
  // More generally, place free particles at equal spacing among the N slots.

  // The t values for all N particles are: 0, 1/(N-1), 2/(N-1), ..., 1
  // Seeds occupy t=0 and t=1, so free particles occupy the interior slots.
  const totalIntervals = n - 1;
  for (let i = 1; i < n - 1; i++) {
    const t = i / totalIntervals;
    const position: OKLab = {
      L: line.start.L + t * (line.end.L - line.start.L),
      a: line.start.a + t * (line.end.a - line.start.a),
      b: line.start.b + t * (line.end.b - line.start.b),
    };
    result.push({ kind: 'free-1d', position, t });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 2D/3D hull initialization
// ---------------------------------------------------------------------------

/**
 * Greedy particle placement with warped area scoring.
 *
 * Algorithm:
 * 1. Start with pinned seeds.
 * 2. For each remaining free particle to place:
 *    a. Score each non-degenerate face: score = subdividedWarpedArea / (1 + particlesOnFace)
 *    b. Select the face with highest score.
 *    c. Sample a 5x5 grid of barycentric coords on that face; pick the point
 *       maximizing minimum warped distance to all existing particles.
 *    d. Create a `free` particle at that position.
 * 3. Gray jitter: for any free particle with chroma < 1e-6, perturb along the
 *    face tangent direction by 1e-5 and recompute barycentric coords.
 */
export function initializeParticlesHull(
  seeds: Particle[],
  hull: HullGeometry,
  atlas: AtlasQuery,
  warp: WarpTransform,
  n: number,
): Particle[] {
  const particles: Particle[] = [...seeds];
  const faceCount = atlas.faceCount();

  while (particles.length < n) {
    // --- Score each non-degenerate face ---
    let bestFaceIndex = -1;
    let bestScore = -Infinity;

    for (let fi = 0; fi < faceCount; fi++) {
      if (atlas.isDegenerate(fi)) continue;

      const [v0, v1, v2] = atlas.getFaceVertices(fi);
      const warpedArea = subdividedWarpedArea(v0, v1, v2, warp);
      const count = countParticlesOnFace(particles, fi, hull);
      const score = warpedArea / (1 + count);

      if (score > bestScore) {
        bestScore = score;
        bestFaceIndex = fi;
      }
    }

    if (bestFaceIndex === -1) {
      // All faces degenerate — fallback: place on first face centroid
      break;
    }

    // --- Find best position on selected face via 5x5 grid ---
    const [v0, v1, v2] = atlas.getFaceVertices(bestFaceIndex);
    const gridSamples = generate5x5BaryGrid();

    let bestBary: Barycentric = { w0: 1 / 3, w1: 1 / 3, w2: 1 / 3 };
    let bestMinDist = -Infinity;

    // Pre-compute warped positions of existing particles
    const warpedParticlePositions = particles.map(p => warp.toWarped(p.position));

    for (const bary of gridSamples) {
      const pos = interpolate(bary, v0, v1, v2);
      const warpedPos = warp.toWarped(pos);

      let minDist = Infinity;
      if (warpedParticlePositions.length === 0) {
        minDist = Infinity;
      } else {
        for (const wp of warpedParticlePositions) {
          const d = Math.sqrt(oklabDistSq(warpedPos, wp));
          if (d < minDist) minDist = d;
        }
      }

      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestBary = bary;
      }
    }

    const position = interpolate(bestBary, v0, v1, v2);
    particles.push({
      kind: 'free',
      position,
      faceIndex: bestFaceIndex,
      bary: bestBary,
    });
  }

  // --- Gray jitter pass ---
  for (let i = seeds.length; i < particles.length; i++) {
    const p = particles[i];
    if (p.kind !== 'free') continue;

    const chroma = Math.sqrt(p.position.a * p.position.a + p.position.b * p.position.b);
    if (chroma >= 1e-6) continue;

    // Perturb along tangent: u for even free-particle index, v for odd
    const freeIndex = i - seeds.length;
    const { u, v: vDir } = atlas.getFaceBasis(p.faceIndex);
    const dir = freeIndex % 2 === 0 ? u : vDir;

    const perturbedPos: OKLab = {
      L: p.position.L + dir[0] * 1e-5,
      a: p.position.a + dir[1] * 1e-5,
      b: p.position.b + dir[2] * 1e-5,
    };

    const [fv0, fv1, fv2] = atlas.getFaceVertices(p.faceIndex);
    let newBary = computeBarycentric(perturbedPos, fv0, fv1, fv2);

    // Clamp if needed (perturbation might push slightly outside)
    if (newBary.w0 < 0 || newBary.w1 < 0 || newBary.w2 < 0) {
      newBary = clampAndRenormalize(newBary);
    }

    const newPos = interpolate(newBary, fv0, fv1, fv2);

    particles[i] = {
      kind: 'free',
      position: newPos,
      faceIndex: p.faceIndex,
      bary: newBary,
    };
  }

  return particles;
}
