import type {
  OKLab,
  Geometry,
  LineGeometry,
  Particle,
  PaletteOptions,
  PaletteResult,
  PaletteStepper,
  OptimizationFrame,
  OptimizationTrace,
} from './types';

import { hexToOklab, oklabToOklch } from './color-conversion';
import { detectDimensionality } from './dimensionality';
import { buildConvexHull } from './convex-hull';
import { classifySeeds } from './seed-classification';
import { buildAtlas } from './atlas';
import { createLineConstraint } from './line-segment';
import { createSurfaceConstraint } from './surface-navigation';
import { createWarpTransform } from './warp';
import { createGamutChecker } from './gamut-clipping';
import { createForceComputer } from './energy';
import { initializeParticles1D, initializeParticlesHull } from './initialization';
import { createOptimizationStepper, createAnnealingSchedule } from './optimization';
import { finalizeColors } from './output';

// ── Validation helpers ──────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateInputs(
  seeds: string[],
  size: number,
  options?: PaletteOptions,
): void {
  // At least 2 seeds
  if (seeds.length < 2) {
    throw new Error('At least 2 seed colors required');
  }

  // Valid hex
  for (const hex of seeds) {
    if (!HEX_RE.test(hex)) {
      throw new Error(`Invalid hex color: ${hex}`);
    }
  }

  // Convert to OKLab for distinctness check
  const oklabSeeds = seeds.map(hexToOklab);

  // All identical check (max pairwise ΔE < 1e-6)
  let allIdentical = true;
  for (let i = 0; i < oklabSeeds.length && allIdentical; i++) {
    for (let j = i + 1; j < oklabSeeds.length; j++) {
      const dL = oklabSeeds[i].L - oklabSeeds[j].L;
      const da = oklabSeeds[i].a - oklabSeeds[j].a;
      const db = oklabSeeds[i].b - oklabSeeds[j].b;
      const dist = Math.sqrt(dL * dL + da * da + db * db);
      if (dist >= 1e-6) {
        allIdentical = false;
        break;
      }
    }
  }
  if (allIdentical) {
    throw new Error('Seeds must be distinct');
  }

  // Size check
  if (size < seeds.length) {
    throw new Error('Palette size must be ≥ number of seeds');
  }

  // Vividness check
  if (options?.vividness !== undefined && options.vividness !== 0) {
    if (options.vividness < 0.005 || options.vividness > 0.10) {
      throw new Error('Vividness must be between 0.005 and 0.10');
    }
  }
}

// ── Composition root ────────────────────────────────────────────────────────

export function createPaletteStepper(
  seeds: string[],
  size: number,
  options?: PaletteOptions,
): PaletteStepper {
  // 1. Validate
  validateInputs(seeds, size, options);

  // 2. Parse seeds
  const oklabSeeds = seeds.map(hexToOklab);

  // 3. Detect dimensionality
  const dimResult = detectDimensionality(oklabSeeds);

  if (dimResult.dimension === 0) {
    throw new Error('Seeds must be distinct');
  }

  let geometry: Geometry;
  let classifiedSeeds: Particle[];
  let particles: Particle[];
  let constraint;

  if (dimResult.dimension === 1) {
    // 4. 1D pipeline
    // Find extremes along the principal axis by projecting seeds
    const axis = dimResult.principalAxes[0]; // first principal axis [L, a, b]
    let minProj = Infinity;
    let maxProj = -Infinity;
    let minIdx = 0;
    let maxIdx = 0;

    // Compute mean for centering
    let meanL = 0, meanA = 0, meanB = 0;
    for (const s of oklabSeeds) {
      meanL += s.L; meanA += s.a; meanB += s.b;
    }
    meanL /= oklabSeeds.length;
    meanA /= oklabSeeds.length;
    meanB /= oklabSeeds.length;

    for (let i = 0; i < oklabSeeds.length; i++) {
      const s = oklabSeeds[i];
      const proj = (s.L - meanL) * axis[0] + (s.a - meanA) * axis[1] + (s.b - meanB) * axis[2];
      if (proj < minProj) { minProj = proj; minIdx = i; }
      if (proj > maxProj) { maxProj = proj; maxIdx = i; }
    }

    const lineGeometry: LineGeometry = {
      kind: 'line',
      start: oklabSeeds[minIdx],
      end: oklabSeeds[maxIdx],
    };

    geometry = lineGeometry;
    classifiedSeeds = classifySeeds(oklabSeeds, lineGeometry);
    constraint = createLineConstraint(lineGeometry.start, lineGeometry.end);
    particles = initializeParticles1D(classifiedSeeds, lineGeometry, size);
  } else {
    // 5. 2D/3D pipeline
    const hull = buildConvexHull(oklabSeeds);
    const atlas = buildAtlas(hull);

    geometry = hull;
    classifiedSeeds = classifySeeds(oklabSeeds, hull);

    constraint = createSurfaceConstraint(atlas, hull);

    // 6. Compute r_s before initializing particles (needed for warp in initialization)
    const chromas = oklabSeeds.map(s => oklabToOklch(s).C);
    const rs = computeRs(chromas, options?.vividness);
    const warpForInit = createWarpTransform(rs);

    particles = initializeParticlesHull(classifiedSeeds, hull, atlas, warpForInit, size);

    // Now wire up the rest with the same rs
    const gamut = createGamutChecker();
    const forces = createForceComputer(warpForInit, gamut);
    const schedule = createAnnealingSchedule();

    const stepper = createOptimizationStepper(particles, forces, constraint, warpForInit, schedule);

    let cachedGenerator: Generator<OptimizationFrame> | null = null;

    return {
      geometry,
      seeds: classifiedSeeds,
      frames() {
        if (cachedGenerator === null) {
          cachedGenerator = stepper;
        }
        return cachedGenerator;
      },
      run() {
        const allFrames = [...this.frames()];
        const lastFrame = allFrames[allFrames.length - 1];
        const { colors, clippedIndices } = finalizeColors(lastFrame.particles, gamut);
        return {
          geometry,
          seeds: classifiedSeeds,
          frames: allFrames,
          finalColors: colors,
          clippedIndices,
          rs: warpForInit.rs,
        };
      },
    };
  }

  // 6. Compute r_s (1D path reaches here)
  const chromas = oklabSeeds.map(s => oklabToOklch(s).C);
  const rs = computeRs(chromas, options?.vividness);

  // 7. Wire up
  const warp = createWarpTransform(rs);
  const gamut = createGamutChecker();
  const forces = createForceComputer(warp, gamut);
  const schedule = createAnnealingSchedule();

  // 8. Create stepper
  const stepper = createOptimizationStepper(particles, forces, constraint, warp, schedule);

  let cachedGenerator: Generator<OptimizationFrame> | null = null;

  // 9. Return PaletteStepper
  return {
    geometry,
    seeds: classifiedSeeds,
    frames() {
      if (cachedGenerator === null) {
        cachedGenerator = stepper;
      }
      return cachedGenerator;
    },
    run() {
      const allFrames = [...this.frames()];
      const lastFrame = allFrames[allFrames.length - 1];
      const { colors, clippedIndices } = finalizeColors(lastFrame.particles, gamut);
      return {
        geometry,
        seeds: classifiedSeeds,
        frames: allFrames,
        finalColors: colors,
        clippedIndices,
        rs: warp.rs,
      };
    },
  };
}

// ── r_s computation ─────────────────────────────────────────────────────────

function computeRs(chromas: number[], vividness?: number): number {
  if (vividness !== undefined && vividness > 0) {
    return vividness;
  }

  // Auto mode: 0.4 * median(seed chromas), clamped to [0.005, 0.10]
  const sorted = [...chromas].sort((a, b) => a - b);
  const n = sorted.length;
  const median =
    n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  return Math.max(0.005, Math.min(0.10, 0.4 * median));
}

// ── Sugar API ───────────────────────────────────────────────────────────────

export function generatePalette(
  seeds: string[],
  size: number,
  options?: PaletteOptions,
): PaletteResult {
  const stepper = createPaletteStepper(seeds, size, options);
  const trace = stepper.run();
  return {
    colors: trace.finalColors,
    seeds,
    metadata: {
      minDeltaE: trace.frames[trace.frames.length - 1].minDeltaE,
      iterations: trace.frames.length,
      clippedCount: trace.clippedIndices.length,
    },
  };
}
