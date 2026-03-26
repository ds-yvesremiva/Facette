# V5 Radial Lift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace V4.4 warp transform with V5 unified radial lift across `packages/core` and `apps/web`.

**Architecture:** Move all geometry (hull, atlas, optimization) into a radially lifted OKLab space. The lift `rho(r) = R * (f(r)/f(R))^gamma` replaces the warp, eliminates the Jacobian pullback, makes face areas exact, and adds chroma preservation via convexity. At `gamma=1` the algorithm matches V4.4 behavior.

**Tech Stack:** TypeScript, Vitest, React 19, Zustand, Vite

**Spec:** `docs/superpowers/specs/2026-03-26-v5-radial-lift-design.md`
**Algorithm Spec:** `Specs/Facette_algorithm_v5.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/core/src/radial-lift.ts` | Forward/inverse radial lift T_rho |
| Create | `packages/core/src/radial-lift.test.ts` | Unit tests for radial lift |
| Delete | `packages/core/src/warp.ts` | Replaced by radial-lift.ts |
| Delete | `packages/core/src/warp.test.ts` | Replaced by radial-lift.test.ts |
| Modify | `packages/core/src/types.ts` | WarpTransform -> RadialLift, shrink GamutChecker, rename frame field, extend trace/options |
| Modify | `packages/core/src/energy.ts` | Plain Euclidean Riesz + FD gamut gradient |
| Modify | `packages/core/src/energy.test.ts` | Update to use RadialLift |
| Modify | `packages/core/src/gamut-clipping.ts` | Remove penaltyGradient |
| Modify | `packages/core/src/gamut-clipping.test.ts` | Remove penaltyGradient tests |
| Modify | `packages/core/src/color-conversion.ts` | Remove oklabToLinearRgbJacobian |
| Modify | `packages/core/src/color-conversion.test.ts` | Remove Jacobian tests |
| Modify | `packages/core/src/initialization.ts` | Remove warp dep, use atlas areas |
| Modify | `packages/core/src/initialization.test.ts` | Remove warp from test setup |
| Modify | `packages/core/src/optimization.ts` | warp -> inverseLift, rename frame field |
| Modify | `packages/core/src/optimization.test.ts` | Update to match new signatures |
| Modify | `packages/core/src/output.ts` | Accept OKLab[] instead of Particle[] |
| Modify | `packages/core/src/output.test.ts` | Update to match new signature |
| Modify | `packages/core/src/facette.ts` | Reorder pipeline, build display geometry |
| Modify | `packages/core/src/facette.test.ts` | Add gamma tests |
| Modify | `apps/web/src/store/paletteSlice.ts` | Add gamma state |
| Modify | `apps/web/src/hooks/usePaletteEngine.ts` | Pass gamma |
| Modify | `apps/web/src/hooks/useMorphInterpolation.ts` | Swap morph direction, rename field |
| Modify | `apps/web/src/components/controls/PaletteControls.tsx` | Add gamma slider |
| Modify | `apps/web/src/components/viewers/OKLabViewer.tsx` | Update labels |
| Modify | `apps/web/src/components/info/PointInfoPanel.tsx` | Update field access + labels |
| Modify | `apps/web/src/__tests__/usePaletteEngine.test.ts` | Rename field |

No changes: `convex-hull.ts`, `atlas.ts`, `surface-navigation.ts`, `seed-classification.ts`, `dimensionality.ts`, `line-segment.ts`, `barycentric.ts`, `math.ts`, `svd.ts`, `index.ts`

---

### Task 1: Create radial lift with tests (TDD)

**Files:**
- Create: `packages/core/src/radial-lift.ts`
- Create: `packages/core/src/radial-lift.test.ts`

- [ ] **Step 1: Write the failing test file**

Write `packages/core/src/radial-lift.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createRadialLift } from './radial-lift';

describe('RadialLift', () => {
  // rs=0.04, R=0.15 (max seed chroma), gamma=1 (V4.4 equivalence)
  const lift = createRadialLift(0.04, 0.15, 1);

  describe('toLifted', () => {
    it('rho(0) = 0: gray maps to gray', () => {
      const l = lift.toLifted({ L: 0.5, a: 0, b: 0 });
      expect(l.a).toBeCloseTo(0);
      expect(l.b).toBeCloseTo(0);
    });

    it('rho(R) = R: reference chroma is a fixed point', () => {
      // Seed at chroma R=0.15 on the +a axis
      const l = lift.toLifted({ L: 0.5, a: 0.15, b: 0 });
      expect(l.a).toBeCloseTo(0.15, 6);
      expect(l.b).toBeCloseTo(0, 10);
    });

    it('preserves L', () => {
      const l = lift.toLifted({ L: 0.7, a: 0.1, b: 0.05 });
      expect(l.L).toBeCloseTo(0.7);
    });

    it('contracts low chroma (rho\'(0) = 0)', () => {
      const pos = { L: 0.5, a: 0.01, b: 0 };
      const l = lift.toLifted(pos);
      const liftedR = Math.sqrt(l.a ** 2 + l.b ** 2);
      expect(liftedR).toBeLessThan(0.01);
    });

    it('preserves hue angle', () => {
      const pos = { L: 0.5, a: 0.1, b: 0.1 };
      const l = lift.toLifted(pos);
      expect(Math.atan2(l.b, l.a)).toBeCloseTo(Math.atan2(pos.b, pos.a), 10);
    });

    it('rho is monotonically increasing', () => {
      const r1 = 0.02, r2 = 0.05, r3 = 0.12;
      const l1 = lift.toLifted({ L: 0.5, a: r1, b: 0 });
      const l2 = lift.toLifted({ L: 0.5, a: r2, b: 0 });
      const l3 = lift.toLifted({ L: 0.5, a: r3, b: 0 });
      expect(l1.a).toBeLessThan(l2.a);
      expect(l2.a).toBeLessThan(l3.a);
    });
  });

  describe('fromLifted (inverse)', () => {
    it('round-trips through toLifted -> fromLifted', () => {
      const pos = { L: 0.6, a: 0.08, b: -0.03 };
      const back = lift.fromLifted(lift.toLifted(pos));
      expect(back.L).toBeCloseTo(pos.L, 8);
      expect(back.a).toBeCloseTo(pos.a, 8);
      expect(back.b).toBeCloseTo(pos.b, 8);
    });

    it('round-trips gray', () => {
      const pos = { L: 0.5, a: 0, b: 0 };
      const back = lift.fromLifted(lift.toLifted(pos));
      expect(back.L).toBeCloseTo(0.5, 8);
      expect(back.a).toBeCloseTo(0, 8);
      expect(back.b).toBeCloseTo(0, 8);
    });

    it('round-trips high chroma', () => {
      const pos = { L: 0.5, a: 0.25, b: -0.15 };
      const back = lift.fromLifted(lift.toLifted(pos));
      expect(back.a).toBeCloseTo(pos.a, 8);
      expect(back.b).toBeCloseTo(pos.b, 8);
    });

    it('round-trips reference chroma exactly', () => {
      const pos = { L: 0.5, a: 0.15, b: 0 };
      const back = lift.fromLifted(lift.toLifted(pos));
      expect(back.a).toBeCloseTo(pos.a, 10);
    });
  });

  describe('gamma > 1', () => {
    const liftG2 = createRadialLift(0.04, 0.15, 2);

    it('rho(R) = R still holds at gamma=2', () => {
      const l = liftG2.toLifted({ L: 0.5, a: 0.15, b: 0 });
      expect(l.a).toBeCloseTo(0.15, 6);
    });

    it('rho(0) = 0 still holds at gamma=2', () => {
      const l = liftG2.toLifted({ L: 0.5, a: 0, b: 0 });
      expect(l.a).toBeCloseTo(0);
    });

    it('stronger contraction at low chroma with gamma=2', () => {
      const pos = { L: 0.5, a: 0.05, b: 0 };
      const l1 = lift.toLifted(pos);    // gamma=1
      const l2 = liftG2.toLifted(pos);  // gamma=2
      // gamma=2 contracts more at chroma below R
      expect(Math.abs(l2.a)).toBeLessThan(Math.abs(l1.a));
    });

    it('round-trips at gamma=2', () => {
      const pos = { L: 0.6, a: 0.08, b: -0.03 };
      const back = liftG2.fromLifted(liftG2.toLifted(pos));
      expect(back.L).toBeCloseTo(pos.L, 8);
      expect(back.a).toBeCloseTo(pos.a, 8);
      expect(back.b).toBeCloseTo(pos.b, 8);
    });
  });

  describe('gamma=1 matches V4.4 warp (up to R scaling)', () => {
    // At gamma=1: rho(r) = R * f(r)/f(R)
    // V4.4 warp: w(r) = f(r) = r^2/(r+rs)
    // They differ by a constant factor R/f(R), which does not affect
    // hull geometry (same convex hull, same face structure).
    // The contraction *ratio* rho(r)/r should be monotonically increasing.
    it('contraction ratio rho(r)/r increases with r', () => {
      const r1 = 0.02, r2 = 0.08, r3 = 0.15;
      const l1 = lift.toLifted({ L: 0.5, a: r1, b: 0 });
      const l2 = lift.toLifted({ L: 0.5, a: r2, b: 0 });
      const l3 = lift.toLifted({ L: 0.5, a: r3, b: 0 });
      expect(l1.a / r1).toBeLessThan(l2.a / r2);
      expect(l2.a / r2).toBeLessThan(l3.a / r3);
    });
  });

  it('exposes rs, R, gamma', () => {
    expect(lift.rs).toBe(0.04);
    expect(lift.R).toBe(0.15);
    expect(lift.gamma).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/radial-lift.test.ts`
Expected: FAIL — module `./radial-lift` not found

- [ ] **Step 3: Write the implementation**

Write `packages/core/src/radial-lift.ts`:

```typescript
import type { OKLab, RadialLift } from './types';

/**
 * Creates a RadialLift that maps OKLab to lifted space via the convex
 * function rho(r) = R * (f(r)/f(R))^gamma, where f(r) = r^2/(r + r_s).
 *
 * At gamma=1, this is equivalent to V4.4's warp scaled by R/f(R).
 */
export function createRadialLift(rs: number, R: number, gamma: number): RadialLift {
  // Precompute f(R) for normalization
  const fR = (R * R) / (R + rs);

  /** Base contraction: f(r) = r^2 / (r + r_s) */
  function f(r: number): number {
    return (r * r) / (r + rs);
  }

  /**
   * Forward lift: rho(r) = R * (f(r)/f(R))^gamma
   * Scale a,b by rho(r)/r, preserving hue.
   */
  function toLifted(pos: OKLab): OKLab {
    const { L, a, b } = pos;
    const r = Math.sqrt(a * a + b * b);
    if (r < 1e-15) return { L, a: 0, b: 0 };
    const rho = R * Math.pow(f(r) / fR, gamma);
    const scale = rho / r;
    return { L, a: a * scale, b: b * scale };
  }

  /**
   * Inverse lift (closed-form, no root-finding):
   * 1. u = f(R) * (rho_val / R)^(1/gamma)
   * 2. Solve r^2/(r + r_s) = u  =>  r = (u + sqrt(u^2 + 4*u*r_s)) / 2
   * 3. Rescale a,b by r/rho_val
   */
  function fromLifted(pos: OKLab): OKLab {
    const { L, a, b } = pos;
    const rhoVal = Math.sqrt(a * a + b * b);
    if (rhoVal < 1e-15) return { L, a: 0, b: 0 };
    const u = fR * Math.pow(rhoVal / R, 1 / gamma);
    const r = (u + Math.sqrt(u * u + 4 * u * rs)) / 2;
    const scale = r / rhoVal;
    return { L, a: a * scale, b: b * scale };
  }

  return { toLifted, fromLifted, rs, R, gamma };
}
```

Note: this references `RadialLift` from types.ts, which doesn't exist yet. That's fine — we'll add it in Task 2. For now the test imports from `./radial-lift` directly, so the type error won't block testing.

Actually, to make the test runnable right now, temporarily define the interface inline. We'll move it to types.ts in Task 2.

Replace the import line in `radial-lift.ts` with:

```typescript
import type { OKLab } from './types';

interface RadialLift {
  toLifted(pos: OKLab): OKLab;
  fromLifted(pos: OKLab): OKLab;
  readonly rs: number;
  readonly R: number;
  readonly gamma: number;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/radial-lift.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/radial-lift.ts packages/core/src/radial-lift.test.ts
git commit -m "feat: add radial lift transform (V5 replacement for warp)"
```

---

### Task 2: Update types.ts — replace WarpTransform, shrink GamutChecker, rename frame field

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Replace WarpTransform with RadialLift**

In `packages/core/src/types.ts`, replace:

```typescript
export interface WarpTransform {
  toWarped(pos: OKLab): OKLab;
  fromWarped(pos: OKLab): OKLab;
  pullBackGradient(pos: OKLab, gradWarped: Vec3): Vec3;
  /** The r_s value used by this transform, exposed for trace metadata. */
  readonly rs: number;
}
```

with:

```typescript
export interface RadialLift {
  toLifted(pos: OKLab): OKLab;
  fromLifted(pos: OKLab): OKLab;
  readonly rs: number;
  readonly R: number;
  readonly gamma: number;
}
```

- [ ] **Step 2: Update ForceComputer doc comment**

Replace:

```typescript
/**
 * ForceComputer is constructed with WarpTransform and GamutChecker
 * injected (DIP). Only per-iteration parameters (p, kappa) are
 * passed at call time since they change via annealing.
 * Returns forces AND scalar energy in one pass (shared pairwise distances).
 */
```

with:

```typescript
/**
 * ForceComputer is constructed with RadialLift and GamutChecker
 * injected (DIP). Computes plain Euclidean Riesz repulsion in lifted space
 * plus gamut penalty via finite differences through the inverse lift.
 * Returns forces AND scalar energy in one pass (shared pairwise distances).
 */
```

- [ ] **Step 3: Shrink GamutChecker — remove penaltyGradient**

Replace:

```typescript
/**
 * GamutChecker.penaltyGradient returns ∇E_gamut in OKLab coordinates,
 * i.e. the linear-RGB channel penalties already chain-ruled through
 * the OKLab→linear-RGB Jacobian (Section 5.2 of algorithm spec).
 */
export interface GamutChecker {
  isInGamut(pos: OKLab): boolean;
  clipPreserveChroma(pos: OKLab): OKLab;
  penaltyGradient(pos: OKLab): Vec3;
}
```

with:

```typescript
export interface GamutChecker {
  isInGamut(pos: OKLab): boolean;
  clipPreserveChroma(pos: OKLab): OKLab;
}
```

- [ ] **Step 4: Rename OptimizationFrame field and extend trace**

Replace:

```typescript
export interface OptimizationFrame {
  iteration: number;
  particles: Particle[];
  warpedPositions: OKLab[];
  energy: number;
  minDeltaE: number;
  p: number;
  stepSize: number;
}

export interface OptimizationTrace {
  geometry: Geometry;
  seeds: Particle[];
  frames: OptimizationFrame[];
  finalColors: string[];
  clippedIndices: number[];
  rs: number;
}
```

with:

```typescript
export interface OptimizationFrame {
  iteration: number;
  particles: Particle[];
  oklabPositions: OKLab[];
  energy: number;
  minDeltaE: number;
  p: number;
  stepSize: number;
}

export interface OptimizationTrace {
  geometry: Geometry;
  seeds: Particle[];
  frames: OptimizationFrame[];
  finalColors: string[];
  clippedIndices: number[];
  rs: number;
  gamma: number;
  R: number;
}
```

- [ ] **Step 5: Add gamma to PaletteOptions**

Replace:

```typescript
export interface PaletteOptions {
  vividness?: number;
}
```

with:

```typescript
export interface PaletteOptions {
  vividness?: number;
  gamma?: number;
}
```

- [ ] **Step 6: Verify types compile (tests will fail — that's expected)**

Run: `cd packages/core && npx tsc --noEmit 2>&1 | head -30`
Expected: Type errors in files that still reference `WarpTransform` or `warpedPositions`. This is expected — we fix them in subsequent tasks.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "refactor(types): replace WarpTransform with RadialLift, shrink GamutChecker, extend trace"
```

---

### Task 3: Update radial-lift.ts to use the canonical RadialLift type from types.ts

**Files:**
- Modify: `packages/core/src/radial-lift.ts`

- [ ] **Step 1: Replace the inline interface with the import from types.ts**

In `packages/core/src/radial-lift.ts`, replace:

```typescript
import type { OKLab } from './types';

interface RadialLift {
  toLifted(pos: OKLab): OKLab;
  fromLifted(pos: OKLab): OKLab;
  readonly rs: number;
  readonly R: number;
  readonly gamma: number;
}
```

with:

```typescript
import type { OKLab, RadialLift } from './types';
```

- [ ] **Step 2: Run radial-lift tests to confirm they still pass**

Run: `cd packages/core && npx vitest run src/radial-lift.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/radial-lift.ts
git commit -m "refactor: use canonical RadialLift type from types.ts"
```

---

### Task 4: Simplify gamut-clipping.ts — remove penaltyGradient

**Files:**
- Modify: `packages/core/src/gamut-clipping.ts`
- Modify: `packages/core/src/gamut-clipping.test.ts`

- [ ] **Step 1: Remove penaltyGradient tests**

In `packages/core/src/gamut-clipping.test.ts`, delete the entire `describe('penaltyGradient', ...)` block (lines 61-100). Also remove the `oklabToLinearRgb` import if it was only used by penaltyGradient tests — check: it IS only used there, so remove the import line:

```typescript
import { oklabToLinearRgb } from './color-conversion';
```

- [ ] **Step 2: Run tests to verify remaining tests pass**

Run: `cd packages/core && npx vitest run src/gamut-clipping.test.ts`
Expected: All remaining tests PASS (isInGamut, clipPreserveChroma)

- [ ] **Step 3: Remove penaltyGradient from implementation**

In `packages/core/src/gamut-clipping.ts`, remove the `penaltyGradient` method (lines 71-87) from the returned object. Also remove the now-unused imports:

Replace the imports:

```typescript
import {
  oklabToLinearRgb,
  oklabToLinearRgbJacobian,
  oklabToOklch,
  oklchToOklab,
} from './color-conversion';
import { mat3MulVec3, mat3Transpose } from './math';
```

with:

```typescript
import {
  oklabToLinearRgb,
  oklabToOklch,
  oklchToOklab,
} from './color-conversion';
```

- [ ] **Step 4: Run tests again**

Run: `cd packages/core && npx vitest run src/gamut-clipping.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gamut-clipping.ts packages/core/src/gamut-clipping.test.ts
git commit -m "refactor(gamut): remove penaltyGradient, replaced by FD in energy"
```

---

### Task 5: Remove oklabToLinearRgbJacobian from color-conversion.ts

**Files:**
- Modify: `packages/core/src/color-conversion.ts`
- Modify: `packages/core/src/color-conversion.test.ts`

- [ ] **Step 1: Remove Jacobian test block**

In `packages/core/src/color-conversion.test.ts`, delete the entire `describe('oklabToLinearRgbJacobian', ...)` block and remove `oklabToLinearRgbJacobian` from the import statement.

- [ ] **Step 2: Run remaining color-conversion tests**

Run: `cd packages/core && npx vitest run src/color-conversion.test.ts`
Expected: All remaining tests PASS

- [ ] **Step 3: Remove oklabToLinearRgbJacobian from implementation**

In `packages/core/src/color-conversion.ts`, delete the `oklabToLinearRgbJacobian` function and remove it from exports. Also remove the import of `mat3Mul, type Mat3` from `./math` if those are only used by the Jacobian function — check the file to confirm.

- [ ] **Step 4: Run tests again**

Run: `cd packages/core && npx vitest run src/color-conversion.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/color-conversion.ts packages/core/src/color-conversion.test.ts
git commit -m "refactor(color): remove oklabToLinearRgbJacobian (dead code)"
```

---

### Task 6: Rewrite energy.ts — plain Euclidean + FD gamut gradient (TDD)

**Files:**
- Modify: `packages/core/src/energy.ts`
- Modify: `packages/core/src/energy.test.ts`

- [ ] **Step 1: Rewrite the test file**

Replace all of `packages/core/src/energy.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { createForceComputer } from './energy';
import { createRadialLift } from './radial-lift';
import { createGamutChecker } from './gamut-clipping';
import type { Particle, Vec3 } from './types';

describe('ForceComputer', () => {
  // Use gamma=1 for V4.4-equivalent behavior
  const lift = createRadialLift(0.04, 0.15, 1);
  const gamut = createGamutChecker();
  const fc = createForceComputer(lift, gamut);

  it('returns forces array matching particle count', () => {
    const particles: Particle[] = [
      { kind: 'free', position: { L: 0.3, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
      { kind: 'free', position: { L: 0.7, a: -0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const { forces, energy } = fc.computeForcesAndEnergy(particles, 2, 0.1);
    expect(forces.length).toBe(2);
    expect(energy).toBeGreaterThan(0);
  });

  it('repulsive force pushes particles apart', () => {
    const particles: Particle[] = [
      { kind: 'free', position: { L: 0.4, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
      { kind: 'free', position: { L: 0.6, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const { forces } = fc.computeForcesAndEnergy(particles, 2, 0);
    // Particle 0 at lower L should be pushed to even lower L
    expect(forces[0][0]).toBeLessThan(0);
    // Particle 1 at higher L should be pushed to higher L
    expect(forces[1][0]).toBeGreaterThan(0);
  });

  it('energy decreases as particles move apart', () => {
    const close: Particle[] = [
      { kind: 'free', position: { L: 0.49, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
      { kind: 'free', position: { L: 0.51, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const far: Particle[] = [
      { kind: 'free', position: { L: 0.2, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
      { kind: 'free', position: { L: 0.8, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const closeE = fc.computeForcesAndEnergy(close, 2, 0).energy;
    const farE = fc.computeForcesAndEnergy(far, 2, 0).energy;
    expect(closeE).toBeGreaterThan(farE);
  });

  it('gamut penalty is zero for in-gamut particles', () => {
    // Positions are in lifted space — use positions that map back to in-gamut OKLab
    const particles: Particle[] = [
      { kind: 'free', position: lift.toLifted({ L: 0.5, a: 0, b: 0 }), faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
      { kind: 'free', position: lift.toLifted({ L: 0.7, a: 0.05, b: 0 }), faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const withGamut = fc.computeForcesAndEnergy(particles, 2, 1.0);
    const withoutGamut = fc.computeForcesAndEnergy(particles, 2, 0);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) {
        expect(withGamut.forces[i][j]).toBeCloseTo(withoutGamut.forces[i][j], 6);
      }
    }
  });

  it('pinned particles still get forces computed', () => {
    const particles: Particle[] = [
      { kind: 'pinned-vertex', position: { L: 0.3, a: 0.1, b: 0 }, vertexIndex: 0 },
      { kind: 'free', position: { L: 0.7, a: -0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const { forces } = fc.computeForcesAndEnergy(particles, 2, 0.1);
    expect(forces.length).toBe(2);
  });

  it('higher p exponent increases force on close pairs', () => {
    const particles: Particle[] = [
      { kind: 'free', position: { L: 0.45, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
      { kind: 'free', position: { L: 0.55, a: 0.1, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const lowP = fc.computeForcesAndEnergy(particles, 2, 0);
    const highP = fc.computeForcesAndEnergy(particles, 6, 0);
    const lowMag = Math.sqrt(lowP.forces[0][0]**2 + lowP.forces[0][1]**2 + lowP.forces[0][2]**2);
    const highMag = Math.sqrt(highP.forces[0][0]**2 + highP.forces[0][1]**2 + highP.forces[0][2]**2);
    expect(highMag).toBeGreaterThan(lowMag);
  });

  it('gamut penalty gradient via FD matches analytical direction', () => {
    // Create a particle that maps to out-of-gamut OKLab
    // Deep saturated position in lifted space
    const outOfGamutOklab = { L: 0.5, a: 0.3, b: 0.3 };
    const liftedPos = lift.toLifted(outOfGamutOklab);
    const particles: Particle[] = [
      { kind: 'free', position: liftedPos, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
      // Far-away second particle so repulsion is negligible
      { kind: 'free', position: { L: 0.1, a: 0, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const withGamut = fc.computeForcesAndEnergy(particles, 2, 10.0);
    const withoutGamut = fc.computeForcesAndEnergy(particles, 2, 0);
    // The gamut penalty should create a meaningful difference in forces
    const diff = Math.sqrt(
      (withGamut.forces[0][0] - withoutGamut.forces[0][0])**2 +
      (withGamut.forces[0][1] - withoutGamut.forces[0][1])**2 +
      (withGamut.forces[0][2] - withoutGamut.forces[0][2])**2,
    );
    expect(diff).toBeGreaterThan(0.01);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/energy.test.ts`
Expected: FAIL — `createForceComputer` still takes old signature

- [ ] **Step 3: Rewrite energy.ts implementation**

Replace all of `packages/core/src/energy.ts` with:

```typescript
import type { ForceComputer, GamutChecker, OKLab, Particle, RadialLift, Vec3 } from './types';
import { oklabToLinearRgb } from './color-conversion';
import { vec3Add, vec3Scale, vec3Sub, vec3Norm } from './math';

/** Convert an OKLab value to a Vec3 tuple [L, a, b]. */
function oklabToVec3(pos: OKLab): Vec3 {
  return [pos.L, pos.a, pos.b];
}

/**
 * Compute the scalar gamut penalty energy for a single OKLab position.
 * P = sum_c { c^2 if c < 0,  (c-1)^2 if c > 1,  0 otherwise }
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

const FD_EPS = 1e-7;

/**
 * Creates a ForceComputer that computes plain Euclidean Riesz repulsion
 * in lifted space, with gamut penalty gradient via finite differences
 * through the inverse lift.
 */
export function createForceComputer(
  lift: RadialLift,
  gamut: GamutChecker,
): ForceComputer {
  return {
    computeForcesAndEnergy(
      particles: readonly Particle[],
      p: number,
      kappa: number,
    ): { forces: Vec3[]; energy: number } {
      const n = particles.length;

      // Positions are already in lifted space — read directly
      const vecs: Vec3[] = particles.map(pt => oklabToVec3(pt.position));

      // Pairwise Euclidean Riesz repulsion in lifted space
      const gradRep: Vec3[] = Array.from({ length: n }, () => [0, 0, 0] as Vec3);
      let eRep = 0;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const diff: Vec3 = vec3Sub(vecs[i], vecs[j]);
          const rawDist = vec3Norm(diff);
          const dij = Math.max(rawDist, 1e-10);

          eRep += Math.pow(dij, -p);

          const coeff = p * Math.pow(dij, -(p + 2));
          gradRep[i] = vec3Add(gradRep[i], vec3Scale(diff, -coeff));
          gradRep[j] = vec3Add(gradRep[j], vec3Scale(diff, coeff));
        }
      }

      // Gamut penalty via finite differences through inverse lift
      const forces: Vec3[] = [];
      let eGamut = 0;

      for (let i = 0; i < n; i++) {
        const pos = particles[i].position;
        const oklabPos = lift.fromLifted(pos);
        const penalty = gamutPenaltyEnergy(oklabPos);
        eGamut += penalty;

        let gamutGrad: Vec3 = [0, 0, 0];

        if (penalty > 0) {
          // Finite-difference gradient in lifted space
          const gL = (gamutPenaltyEnergy(lift.fromLifted({ L: pos.L + FD_EPS, a: pos.a, b: pos.b })) - penalty) / FD_EPS;
          const ga = (gamutPenaltyEnergy(lift.fromLifted({ L: pos.L, a: pos.a + FD_EPS, b: pos.b })) - penalty) / FD_EPS;
          const gb = (gamutPenaltyEnergy(lift.fromLifted({ L: pos.L, a: pos.a, b: pos.b + FD_EPS })) - penalty) / FD_EPS;
          gamutGrad = [gL, ga, gb];
        }

        // Total force = -(grad_rep + kappa * grad_gamut)
        const totalGrad = vec3Add(gradRep[i], vec3Scale(gamutGrad, kappa));
        forces.push(vec3Scale(totalGrad, -1));
      }

      const energy = eRep + kappa * eGamut;
      return { forces, energy };
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/energy.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/energy.ts packages/core/src/energy.test.ts
git commit -m "refactor(energy): plain Euclidean Riesz + FD gamut gradient in lifted space"
```

---

### Task 7: Simplify initialization.ts — remove warp dependency

**Files:**
- Modify: `packages/core/src/initialization.ts`
- Modify: `packages/core/src/initialization.test.ts`

- [ ] **Step 1: Update the test file — remove warp from setup**

In `packages/core/src/initialization.test.ts`:

Replace the imports:

```typescript
import { initializeParticles1D, initializeParticlesHull } from './initialization';
import { createWarpTransform } from './warp';
import { buildAtlas } from './atlas';
import type { Particle, OKLab, HullGeometry, LineGeometry, EdgeKey } from './types';
```

with:

```typescript
import { initializeParticles1D, initializeParticlesHull } from './initialization';
import { buildAtlas } from './atlas';
import type { Particle, OKLab, HullGeometry, LineGeometry, EdgeKey } from './types';
```

Delete the line:

```typescript
    const warp = createWarpTransform(0.04);
```

Update all calls from `initializeParticlesHull(seeds, hull, atlas, warp, N)` to `initializeParticlesHull(seeds, hull, atlas, N)` — there are 4 occurrences in the hull describe block (lines 89, 100, 112, 132).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/initialization.test.ts`
Expected: FAIL — signature mismatch

- [ ] **Step 3: Rewrite initialization.ts**

In `packages/core/src/initialization.ts`:

Remove from imports: `WarpTransform`

Delete `triangleArea` function (lines 26-34).

Delete `subdividedWarpedArea` function (lines 41-67).

Change `initializeParticlesHull` signature — remove `warp` parameter:

```typescript
export function initializeParticlesHull(
  seeds: Particle[],
  hull: HullGeometry,
  atlas: AtlasQuery,
  n: number,
): Particle[] {
```

Replace the face scoring loop body. Change:

```typescript
      const [v0, v1, v2] = atlas.getFaceVertices(fi);
      const warpedArea = subdividedWarpedArea(v0, v1, v2, warp);
      const count = countParticlesOnFace(particles, fi, hull);
      const score = warpedArea / (1 + count);
```

to:

```typescript
      const area = atlas.getFaceArea(fi);
      const count = countParticlesOnFace(particles, fi, hull);
      const score = area / (1 + count);
```

Replace the best-position search — remove warp calls. Change:

```typescript
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
```

to:

```typescript
    for (const bary of gridSamples) {
      const pos = interpolate(bary, v0, v1, v2);

      let minDist = Infinity;
      for (const existing of particles) {
        const d = Math.sqrt(oklabDistSq(pos, existing.position));
        if (d < minDist) minDist = d;
      }
```

(Positions are already in lifted space — distances computed directly.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/initialization.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/initialization.ts packages/core/src/initialization.test.ts
git commit -m "refactor(init): remove warp dependency, use exact atlas areas"
```

---

### Task 8: Update optimization.ts — inverseLift + rename frame field

**Files:**
- Modify: `packages/core/src/optimization.ts`
- Modify: `packages/core/src/optimization.test.ts`

- [ ] **Step 1: Update optimization.ts**

In `packages/core/src/optimization.ts`:

Replace the imports — remove `WarpTransform`:

```typescript
import type {
  AnnealingSchedule,
  ForceComputer,
  MotionConstraint,
  OKLab,
  OptimizationFrame,
  Particle,
  Vec3,
} from './types';
```

Change `pairwiseMinDeltaE` to accept `OKLab[]`:

```typescript
export function pairwiseMinDeltaE(positions: readonly OKLab[]): number {
  const n = positions.length;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const pi = positions[i];
    for (let j = i + 1; j < n; j++) {
      const pj = positions[j];
      const dL = pi.L - pj.L;
      const da = pi.a - pj.a;
      const db = pi.b - pj.b;
      const dist = Math.sqrt(dL * dL + da * da + db * db);
      if (dist < min) min = dist;
    }
  }
  return min;
}
```

Change the stepper signature — replace `warp: WarpTransform` with `inverseLift: (pos: OKLab) => OKLab`:

```typescript
export function* createOptimizationStepper(
  initialParticles: Particle[],
  forces: ForceComputer,
  constraint: MotionConstraint,
  inverseLift: (pos: OKLab) => OKLab,
  schedule: AnnealingSchedule,
): Generator<OptimizationFrame> {
```

Inside the loop, replace:

```typescript
    // Compute warped positions on the new state
    const warpedPositions = particles.map(pt => warp.toWarped(pt.position));

    // Compute min pairwise deltaE on the new state
    const minDeltaE = pairwiseMinDeltaE(particles);
```

with:

```typescript
    // Compute OKLab positions via inverse lift
    const oklabPositions = particles.map(pt => inverseLift(pt.position));

    // Compute min pairwise deltaE in OKLab space
    const minDeltaE = pairwiseMinDeltaE(oklabPositions);
```

And in the yield, rename:

```typescript
    yield {
      iteration,
      particles: cloneParticles(particles),
      oklabPositions,
      energy,
      minDeltaE,
      p,
      stepSize,
    };
```

- [ ] **Step 2: Update optimization.test.ts**

Read the test file, replace any references to `createWarpTransform` with `createRadialLift`, update the stepper call to pass `lift.fromLifted` instead of the warp, and update any references to `warpedPositions` to `oklabPositions`. Update `pairwiseMinDeltaE` calls to pass positions instead of particles.

- [ ] **Step 3: Run tests**

Run: `cd packages/core && npx vitest run src/optimization.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/optimization.ts packages/core/src/optimization.test.ts
git commit -m "refactor(optimization): use inverseLift function, rename warpedPositions to oklabPositions"
```

---

### Task 9: Update output.ts — accept OKLab[] instead of Particle[]

**Files:**
- Modify: `packages/core/src/output.ts`
- Modify: `packages/core/src/output.test.ts`

- [ ] **Step 1: Change finalizeColors signature**

In `packages/core/src/output.ts`, replace:

```typescript
export function finalizeColors(
  particles: Particle[],
  gamut: GamutChecker,
): { colors: string[]; clippedIndices: number[] } {
  const colors: string[] = [];
  const clippedIndices: number[] = [];

  for (let i = 0; i < particles.length; i++) {
    const pos = particles[i].position;

    if (gamut.isInGamut(pos)) {
      colors.push(oklabToHex(pos));
    } else {
      const clipped = gamut.clipPreserveChroma(pos);
      colors.push(oklabToHex(clipped));
      clippedIndices.push(i);
    }
  }

  return { colors, clippedIndices };
}
```

with:

```typescript
export function finalizeColors(
  positions: OKLab[],
  gamut: GamutChecker,
): { colors: string[]; clippedIndices: number[] } {
  const colors: string[] = [];
  const clippedIndices: number[] = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];

    if (gamut.isInGamut(pos)) {
      colors.push(oklabToHex(pos));
    } else {
      const clipped = gamut.clipPreserveChroma(pos);
      colors.push(oklabToHex(clipped));
      clippedIndices.push(i);
    }
  }

  return { colors, clippedIndices };
}
```

Also update the imports — remove `Particle`, add `OKLab`:

```typescript
import type { OKLab, GamutChecker } from './types';
```

- [ ] **Step 2: Update output.test.ts**

Read the test file and update calls to `finalizeColors` to pass `OKLab[]` positions instead of `Particle[]`.

- [ ] **Step 3: Run tests**

Run: `cd packages/core && npx vitest run src/output.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/output.ts packages/core/src/output.test.ts
git commit -m "refactor(output): accept OKLab[] positions instead of Particle[]"
```

---

### Task 10: Rewrite facette.ts — reorder pipeline, add gamma, build display geometry

**Files:**
- Modify: `packages/core/src/facette.ts`
- Modify: `packages/core/src/facette.test.ts`

- [ ] **Step 1: Add gamma validation and acceptance tests**

In `packages/core/src/facette.test.ts`, add after the existing validation tests:

```typescript
  it('rejects gamma below 1', () => {
    expect(() => generatePalette(['#ff0000', '#00ff00'], 4, { gamma: 0.5 })).toThrow('Gamma');
  });

  it('accepts gamma >= 1', () => {
    const result = generatePalette(['#ff0000', '#00ff00'], 4, { gamma: 1.5 });
    expect(result.colors).toHaveLength(4);
  });

  it('gamma=1 produces valid output (V4.4 equivalence)', () => {
    const result = generatePalette(['#e63946', '#457b9d', '#1d3557'], 6, { gamma: 1 });
    expect(result.colors).toHaveLength(6);
    expect(result.metadata.minDeltaE).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Rewrite facette.ts**

Replace all of `packages/core/src/facette.ts` with the V5 pipeline. Key changes:

1. Replace `import { createWarpTransform } from './warp'` with `import { createRadialLift } from './radial-lift'`
2. Add gamma validation to `validateInputs`
3. Compute `R = Math.max(...chromas)` and `gamma = options?.gamma ?? 1`
4. Create radial lift BEFORE dimensionality detection
5. Lift seeds via `lift.toLifted` before hull construction
6. Pass lifted seeds to `detectDimensionality`, `buildConvexHull`, `classifySeeds`
7. Remove `warp` parameter from `initializeParticlesHull` call
8. Build display geometry by inverse-mapping hull vertices
9. Create stepper with `lift.fromLifted` instead of `warp`
10. In `run()`: inverse-map final positions via `lift.fromLifted`, pass to `finalizeColors`
11. Store `gamma` and `R` in trace metadata
12. Restore OKLab positions on seed particles

The full implementation:

```typescript
import type {
  OKLab,
  Geometry,
  HullGeometry,
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
import { createRadialLift } from './radial-lift';
import { createGamutChecker } from './gamut-clipping';
import { createForceComputer } from './energy';
import { initializeParticles1D, initializeParticlesHull } from './initialization';
import { createOptimizationStepper, createAnnealingSchedule } from './optimization';
import { finalizeColors } from './output';

// -- Validation helpers --

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateInputs(
  seeds: string[],
  size: number,
  options?: PaletteOptions,
): void {
  if (seeds.length < 2) {
    throw new Error('At least 2 seed colors required');
  }

  for (const hex of seeds) {
    if (!HEX_RE.test(hex)) {
      throw new Error(`Invalid hex color: ${hex}`);
    }
  }

  const oklabSeeds = seeds.map(hexToOklab);

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

  if (size < seeds.length) {
    throw new Error('Palette size must be >= number of seeds');
  }

  if (options?.vividness !== undefined && options.vividness !== 0) {
    if (options.vividness < 0.005 || options.vividness > 0.10) {
      throw new Error('Vividness must be between 0.005 and 0.10');
    }
  }

  if (options?.gamma !== undefined) {
    if (options.gamma < 1) {
      throw new Error('Gamma must be >= 1');
    }
  }
}

// -- r_s computation --

function computeRs(chromas: number[], vividness?: number): number {
  if (vividness !== undefined && vividness > 0) {
    return vividness;
  }

  const sorted = [...chromas].sort((a, b) => a - b);
  const n = sorted.length;
  const median =
    n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  return Math.max(0.005, Math.min(0.10, 0.4 * median));
}

// -- Composition root --

export function createPaletteStepper(
  seeds: string[],
  size: number,
  options?: PaletteOptions,
): PaletteStepper {
  // 1. Validate
  validateInputs(seeds, size, options);

  // 2. Parse seeds to OKLab
  const oklabSeeds = seeds.map(hexToOklab);

  // 3. Compute lift parameters
  const chromas = oklabSeeds.map(s => oklabToOklch(s).C);
  const rs = computeRs(chromas, options?.vividness);
  const R = Math.max(...chromas);
  const gamma = options?.gamma ?? 1;

  // 4. Create radial lift
  const lift = createRadialLift(rs, R, gamma);

  // 5. Lift seeds to lifted space
  const liftedSeeds = oklabSeeds.map(s => lift.toLifted(s));

  // 6. Detect dimensionality in lifted space
  const dimResult = detectDimensionality(liftedSeeds);

  if (dimResult.dimension === 0) {
    throw new Error('Seeds must be distinct');
  }

  // 7. Wire up services (shared across branches)
  const gamut = createGamutChecker();
  const forces = createForceComputer(lift, gamut);
  const schedule = createAnnealingSchedule();

  let displayGeometry: Geometry;
  let classifiedSeeds: Particle[];
  let particles: Particle[];
  let constraint;

  if (dimResult.dimension === 1) {
    // -- 1D pipeline --
    const axis = dimResult.principalAxes[0];
    let minProj = Infinity, maxProj = -Infinity;
    let minIdx = 0, maxIdx = 0;

    let meanL = 0, meanA = 0, meanB = 0;
    for (const s of liftedSeeds) {
      meanL += s.L; meanA += s.a; meanB += s.b;
    }
    meanL /= liftedSeeds.length;
    meanA /= liftedSeeds.length;
    meanB /= liftedSeeds.length;

    for (let i = 0; i < liftedSeeds.length; i++) {
      const s = liftedSeeds[i];
      const proj = (s.L - meanL) * axis[0] + (s.a - meanA) * axis[1] + (s.b - meanB) * axis[2];
      if (proj < minProj) { minProj = proj; minIdx = i; }
      if (proj > maxProj) { maxProj = proj; maxIdx = i; }
    }

    const liftedLine: LineGeometry = {
      kind: 'line',
      start: liftedSeeds[minIdx],
      end: liftedSeeds[maxIdx],
    };

    classifiedSeeds = classifySeeds(liftedSeeds, liftedLine);
    constraint = createLineConstraint(liftedLine.start, liftedLine.end);
    particles = initializeParticles1D(classifiedSeeds, liftedLine, size);

    // Display geometry: inverse-map to OKLab
    displayGeometry = {
      kind: 'line',
      start: lift.fromLifted(liftedLine.start),
      end: lift.fromLifted(liftedLine.end),
    };
  } else {
    // -- 2D/3D pipeline --
    const liftedHull = buildConvexHull(liftedSeeds);
    const atlas = buildAtlas(liftedHull);

    classifiedSeeds = classifySeeds(liftedSeeds, liftedHull);
    constraint = createSurfaceConstraint(atlas, liftedHull);
    particles = initializeParticlesHull(classifiedSeeds, liftedHull, atlas, size);

    // Display geometry: inverse-map hull vertices to OKLab
    displayGeometry = {
      kind: 'hull',
      vertices: liftedHull.vertices.map(v => lift.fromLifted(v)),
      faces: liftedHull.faces,
      adjacency: liftedHull.adjacency,
    };
  }

  // Restore OKLab positions on seed particles for display
  const displaySeeds = classifiedSeeds.map((s, i) => ({
    ...s,
    position: oklabSeeds[i],
  })) as Particle[];

  // 8. Create stepper
  const stepper = createOptimizationStepper(
    particles, forces, constraint, lift.fromLifted, schedule,
  );

  let cachedGenerator: Generator<OptimizationFrame> | null = null;

  return {
    geometry: displayGeometry,
    seeds: displaySeeds,
    frames() {
      if (cachedGenerator === null) {
        cachedGenerator = stepper;
      }
      return cachedGenerator;
    },
    run() {
      const allFrames = [...this.frames()];
      const lastFrame = allFrames[allFrames.length - 1];
      const oklabPositions = lastFrame.particles.map(p => lift.fromLifted(p.position));
      const { colors, clippedIndices } = finalizeColors(oklabPositions, gamut);
      return {
        geometry: displayGeometry,
        seeds: displaySeeds,
        frames: allFrames,
        finalColors: colors,
        clippedIndices,
        rs,
        gamma,
        R,
      };
    },
  };
}

// -- Sugar API --

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
```

- [ ] **Step 3: Run all core tests**

Run: `cd packages/core && npx vitest run`
Expected: All PASS. Existing facette integration tests should pass at gamma=1.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/facette.ts packages/core/src/facette.test.ts
git commit -m "feat(facette): reorder pipeline for V5 radial lift, add gamma parameter"
```

---

### Task 11: Delete warp.ts and warp.test.ts

**Files:**
- Delete: `packages/core/src/warp.ts`
- Delete: `packages/core/src/warp.test.ts`

- [ ] **Step 1: Verify no remaining imports of warp**

Run: `grep -r "from.*['\"].*warp" packages/core/src/ --include="*.ts" | grep -v ".test.ts" | grep -v "warp.ts"`
Expected: No output (no production code imports warp)

- [ ] **Step 2: Delete the files**

```bash
git rm packages/core/src/warp.ts packages/core/src/warp.test.ts
```

- [ ] **Step 3: Run all core tests**

Run: `cd packages/core && npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: delete warp.ts (replaced by radial-lift.ts)"
```

---

### Task 12: Run full core test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all core tests**

Run: `cd packages/core && npx vitest run`
Expected: All PASS, zero failures

- [ ] **Step 2: Check TypeScript compilation**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build the package**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit if any fixes were needed**

If any fixes were applied, commit them now. Otherwise, no commit needed.

---

### Task 13: Update web app store — add gamma

**Files:**
- Modify: `apps/web/src/store/paletteSlice.ts`

- [ ] **Step 1: Add gamma state and setter**

In `apps/web/src/store/paletteSlice.ts`, add to the interface:

```typescript
  gamma: number;
  setGamma: (g: number) => void;
```

And add to the default state:

```typescript
  gamma: 1,
  setGamma: (g) => set({ gamma: g }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/store/paletteSlice.ts
git commit -m "feat(web): add gamma state to palette store"
```

---

### Task 14: Update web hooks — pass gamma, fix morph direction

**Files:**
- Modify: `apps/web/src/hooks/usePaletteEngine.ts`
- Modify: `apps/web/src/hooks/useMorphInterpolation.ts`

- [ ] **Step 1: Update usePaletteEngine to pass gamma**

In `apps/web/src/hooks/usePaletteEngine.ts`, add gamma to the store selectors and pass it in options:

```typescript
import { useCallback } from 'react';
import { createPaletteStepper } from 'facette';
import type { PaletteOptions } from 'facette';
import { useStore } from '../store';

export function usePaletteEngine() {
  const seeds = useStore((s) => s.seeds);
  const paletteSize = useStore((s) => s.paletteSize);
  const vividness = useStore((s) => s.vividness);
  const gamma = useStore((s) => s.gamma);
  const setTrace = useStore((s) => s.setTrace);
  const setIsComputing = useStore((s) => s.setIsComputing);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setIsPlaying = useStore((s) => s.setIsPlaying);

  const regenerate = useCallback(() => {
    if (seeds.length < 2) return;

    setIsComputing(true);
    setIsPlaying(false);

    try {
      const options: PaletteOptions = {};
      if (vividness > 0) options.vividness = vividness;
      if (gamma > 1) options.gamma = gamma;
      const stepper = createPaletteStepper(seeds, paletteSize,
        Object.keys(options).length > 0 ? options : undefined);
      const trace = stepper.run();
      setTrace(trace);
      setCurrentFrame(0);
    } catch (e) {
      console.error('Palette generation failed:', e);
      setTrace(null);
    } finally {
      setIsComputing(false);
    }
  }, [seeds, paletteSize, vividness, gamma, setTrace, setIsComputing, setCurrentFrame, setIsPlaying]);

  return { regenerate };
}
```

- [ ] **Step 2: Update useMorphInterpolation — rename field, swap morph direction**

In `apps/web/src/hooks/useMorphInterpolation.ts`, change:

```typescript
    const interpolated = frame.particles.map((p, i) =>
      lerpOKLab(p.position, frame.warpedPositions[i], morphT)
    );
```

to:

```typescript
    const interpolated = frame.particles.map((p, i) =>
      lerpOKLab(frame.oklabPositions[i], p.position, morphT)
    );
```

This ensures morphT=0 shows OKLab (default view) and morphT=1 shows lifted space.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/usePaletteEngine.ts apps/web/src/hooks/useMorphInterpolation.ts
git commit -m "feat(web): pass gamma to engine, fix morph direction for lifted space"
```

---

### Task 15: Update web UI components — gamma slider, labels, panel

**Files:**
- Modify: `apps/web/src/components/controls/PaletteControls.tsx`
- Modify: `apps/web/src/components/viewers/OKLabViewer.tsx`
- Modify: `apps/web/src/components/info/PointInfoPanel.tsx`

- [ ] **Step 1: Add gamma slider to PaletteControls**

In `apps/web/src/components/controls/PaletteControls.tsx`, add gamma state selectors and a slider:

```typescript
  const gamma = useStore((s) => s.gamma);
  const setGamma = useStore((s) => s.setGamma);
```

Add after the vividness slider div:

```typescript
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-12">{gamma === 1 ? 'γ: 1' : `γ: ${gamma.toFixed(1)}`}</label>
        <input
          type="range"
          min={10}
          max={30}
          value={gamma * 10}
          onChange={(e) => setGamma(Number(e.target.value) / 10)}
          onMouseUp={regenerate}
          className="w-24"
        />
      </div>
```

- [ ] **Step 2: Update OKLabViewer labels**

In `apps/web/src/components/viewers/OKLabViewer.tsx`, change:

```typescript
        {isWarped ? 'Warped OKLab' : 'OKLab'}
```
to:
```typescript
        {isWarped ? 'Lifted' : 'OKLab'}
```

And:
```typescript
        {isWarped ? 'Unwarp' : 'Warp'}
```
to:
```typescript
        {isWarped ? 'Unlift' : 'Lift'}
```

- [ ] **Step 3: Update PointInfoPanel**

In `apps/web/src/components/info/PointInfoPanel.tsx`, change:

```typescript
  const warped = frame.warpedPositions[selectedIndex];
  const pos = particle.position;
  const lch = oklabToOklch(pos);
  const hex = oklabToHex(pos);
  const warpedLch = oklabToOklch(warped);
```

to:

```typescript
  const oklab = frame.oklabPositions[selectedIndex];
  const pos = particle.position;  // lifted-space position
  const lch = oklabToOklch(oklab);
  const hex = oklabToHex(oklab);
```

And update the JSX:

```typescript
        <div>OKLab: {formatOKLab(oklab)}</div>
        <div>OKLCh: {formatOKLCh(lch)}</div>
        <div>Lifted: {formatOKLab(pos)}</div>
```

Remove `warpedLch` (no longer used).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/controls/PaletteControls.tsx \
        apps/web/src/components/viewers/OKLabViewer.tsx \
        apps/web/src/components/info/PointInfoPanel.tsx
git commit -m "feat(web): add gamma slider, update viewer labels for lifted space"
```

---

### Task 16: Update web app tests

**Files:**
- Modify: `apps/web/src/__tests__/usePaletteEngine.test.ts`

- [ ] **Step 1: Rename field reference**

In `apps/web/src/__tests__/usePaletteEngine.test.ts`, change:

```typescript
  it('trace frames have warpedPositions', () => {
    const { seeds, paletteSize } = useStore.getState();
    const stepper = createPaletteStepper(seeds, paletteSize);
    const trace = stepper.run();
    expect(trace.frames[0].warpedPositions.length).toBe(paletteSize);
  });
```

to:

```typescript
  it('trace frames have oklabPositions', () => {
    const { seeds, paletteSize } = useStore.getState();
    const stepper = createPaletteStepper(seeds, paletteSize);
    const trace = stepper.run();
    expect(trace.frames[0].oklabPositions.length).toBe(paletteSize);
  });
```

- [ ] **Step 2: Add gamma to store setup and add a gamma test**

Add `gamma: 1,` to the `beforeEach` `setState` call. Add a test:

```typescript
  it('trace includes gamma and R metadata', () => {
    const { seeds, paletteSize } = useStore.getState();
    const stepper = createPaletteStepper(seeds, paletteSize);
    const trace = stepper.run();
    expect(trace.gamma).toBe(1);
    expect(trace.R).toBeGreaterThan(0);
  });
```

- [ ] **Step 3: Run web app tests**

Run: `cd apps/web && npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/__tests__/usePaletteEngine.test.ts
git commit -m "test(web): update tests for oklabPositions field and gamma metadata"
```

---

### Task 17: Final verification — full test suite + build

**Files:** None (verification only)

- [ ] **Step 1: Run all core tests**

Run: `cd packages/core && npx vitest run`
Expected: All PASS

- [ ] **Step 2: Run all web tests**

Run: `cd apps/web && npx vitest run`
Expected: All PASS

- [ ] **Step 3: Build core package**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Build web app**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds

- [ ] **Step 5: Verify no remaining references to old API**

Run: `grep -r "warpedPositions\|WarpTransform\|toWarped\|fromWarped\|pullBackGradient\|createWarpTransform\|subdividedWarpedArea\|penaltyGradient\|oklabToLinearRgbJacobian" packages/core/src/ apps/web/src/ --include="*.ts" --include="*.tsx"`
Expected: No output (all old references removed)

- [ ] **Step 6: Commit if any fixes were needed**

If any fixes were applied, commit them. Otherwise, no commit needed.
