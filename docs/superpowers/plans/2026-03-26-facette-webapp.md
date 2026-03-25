# Facette Webapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React debug dashboard with dual 3D views (OKLab + OKLCh), animated optimization playback, morph between warped/unwarped space, point inspection, and interactive seed editing.

**Architecture:** React + Vite + TypeScript + Tailwind CSS 4 + React Three Fiber. Zustand with 4 domain slices for state management. Shared 3D components with `positionMapper` prop for DRY rendering across both coordinate systems. The webapp imports `facette` (core package) as a workspace dependency.

**Tech Stack:** React 19, Vite 6, TypeScript 5.x, Tailwind CSS 4, React Three Fiber (@react-three/fiber + @react-three/drei), Zustand 5, vitest

**Reference docs:**
- Design spec: `docs/superpowers/specs/2026-03-25-facette-design.md` (Section 4)
- Core package API: `packages/core/src/index.ts`

**Prerequisite:** Core package (`packages/core`) is complete with 178 passing tests.

---

## File Structure

```
apps/web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── postcss.config.js               # Empty — Tailwind 4 uses Vite plugin
├── vitest.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                        # Tailwind directives
│   │
│   ├── store/
│   │   ├── index.ts                     # Combined Zustand store
│   │   ├── paletteSlice.ts             # Seeds, N, vividness, trace, finalColors
│   │   ├── viewerSlice.ts              # Layer toggles, morph position, camera
│   │   ├── playbackSlice.ts            # Frame index, playing/paused, speed
│   │   └── selectionSlice.ts           # Selected point, hover
│   │
│   ├── hooks/
│   │   ├── usePaletteEngine.ts         # Runs createPaletteStepper, stores trace
│   │   ├── usePlayback.ts              # rAF loop for animation
│   │   ├── useSyncedCamera.ts          # Camera sync between viewers
│   │   └── useMorphInterpolation.ts    # Lerp warped ↔ unwarped
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── DashboardLayout.tsx
│   │   ├── controls/
│   │   │   ├── SeedEditor.tsx
│   │   │   ├── PaletteControls.tsx
│   │   │   ├── PlaybackControls.tsx
│   │   │   └── LayerToggles.tsx
│   │   ├── viewers/
│   │   │   ├── OKLabViewer.tsx
│   │   │   ├── OKLChViewer.tsx
│   │   │   ├── shared/
│   │   │   │   ├── SceneSetup.tsx
│   │   │   │   ├── HullMesh.tsx
│   │   │   │   ├── ParticlePoints.tsx
│   │   │   │   ├── GamutBoundary.tsx
│   │   │   │   ├── AxisHelper.tsx
│   │   │   │   └── MorphAnimator.tsx
│   │   │   └── transforms/
│   │   │       ├── oklabToScene.ts
│   │   │       └── oklchToScene.ts
│   │   ├── info/
│   │   │   ├── PointInfoPanel.tsx
│   │   │   └── EnergyGraph.tsx
│   │   └── palette/
│   │       └── PaletteStrip.tsx
│   │
│   ├── assets/
│   │   └── srgb-gamut.json             # Precomputed gamut boundary mesh
│   │
│   ├── utils/
│   │   └── color-format.ts
│   │
│   └── __tests__/
│       ├── store.test.ts
│       ├── transforms.test.ts
│       └── usePaletteEngine.test.ts
```

---

### Task 1: Webapp Scaffolding

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/vite-env.d.ts`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@facette/web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "preview": "vite preview"
  },
  "dependencies": {
    "facette": "workspace:*",
    "react": "^19",
    "react-dom": "^19",
    "@react-three/fiber": "^9",
    "@react-three/drei": "^10",
    "three": "^0.172",
    "zustand": "^5"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/three": "^0.172",
    "@tailwindcss/vite": "^4",
    "tailwindcss": "^4",
    "autoprefixer": "^10",
    "typescript": "^5.7",
    "vite": "^6",
    "vitest": "^3",
    "@vitejs/plugin-react": "^4"
  }
}
```

- [ ] **Step 2: Create `apps/web/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Facette — Color Palette Debug Dashboard</title>
  </head>
  <body class="bg-gray-950 text-gray-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: ['development', 'browser'],
  },
});
```

- [ ] **Step 4: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'jsdom',
  },
});
```

- [ ] **Step 6: Create `apps/web/postcss.config.js`**

```js
export default {};
```

- [ ] **Step 7: Create `apps/web/src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Create `apps/web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 9: Create minimal `apps/web/src/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">Facette Debug Dashboard</h1>
    </div>
  );
}
```

- [ ] **Step 10: Create `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 11: Install dependencies and verify**

```bash
cd C:/Users/yves-/code/Facette && pnpm install
cd apps/web && npx vite build
```

Expected: build succeeds with no errors.

- [ ] **Step 12: Verify dev server starts**

```bash
cd apps/web && npx vite --port 3000 &
# Wait a few seconds, then curl or check
```

Kill the dev server after verification.

- [ ] **Step 13: Commit**

```bash
git add apps/web/ && git commit -m "feat(web): scaffold Vite + React + Tailwind + R3F webapp"
```

---

### Task 2: Zustand Store Slices

**Files:**
- Create: `apps/web/src/store/paletteSlice.ts`
- Create: `apps/web/src/store/viewerSlice.ts`
- Create: `apps/web/src/store/playbackSlice.ts`
- Create: `apps/web/src/store/selectionSlice.ts`
- Create: `apps/web/src/store/index.ts`

- [ ] **Step 1: Create `paletteSlice.ts`**

```ts
import type { StateCreator } from 'zustand';
import type { OptimizationTrace, Particle } from 'facette';

export interface PaletteSlice {
  seeds: string[];
  paletteSize: number;
  vividness: number; // 0 = auto
  trace: OptimizationTrace | null;
  isComputing: boolean;

  setSeeds: (seeds: string[]) => void;
  addSeed: (hex: string) => void;
  removeSeed: (index: number) => void;
  updateSeed: (index: number, hex: string) => void;
  setPaletteSize: (n: number) => void;
  setVividness: (v: number) => void;
  setTrace: (trace: OptimizationTrace | null) => void;
  setIsComputing: (v: boolean) => void;
}

export const createPaletteSlice: StateCreator<PaletteSlice> = (set) => ({
  seeds: ['#e63946', '#457b9d', '#1d3557'],
  paletteSize: 8,
  vividness: 0,
  trace: null,
  isComputing: false,

  setSeeds: (seeds) => set({ seeds }),
  addSeed: (hex) => set((s) => ({ seeds: [...s.seeds, hex] })),
  removeSeed: (index) => set((s) => ({ seeds: s.seeds.filter((_, i) => i !== index) })),
  updateSeed: (index, hex) => set((s) => ({
    seeds: s.seeds.map((c, i) => (i === index ? hex : c)),
  })),
  setPaletteSize: (n) => set({ paletteSize: n }),
  setVividness: (v) => set({ vividness: v }),
  setTrace: (trace) => set({ trace }),
  setIsComputing: (v) => set({ isComputing: v }),
});
```

- [ ] **Step 2: Create `viewerSlice.ts`**

```ts
import type { StateCreator } from 'zustand';

export interface ViewerSlice {
  showSeeds: boolean;
  showGenerated: boolean;
  showHull: boolean;
  showGamut: boolean;
  showAxes: boolean;
  morphT: number; // 0 = unwarped, 1 = warped

  toggleSeeds: () => void;
  toggleGenerated: () => void;
  toggleHull: () => void;
  toggleGamut: () => void;
  toggleAxes: () => void;
  setMorphT: (t: number) => void;
}

export const createViewerSlice: StateCreator<ViewerSlice> = (set) => ({
  showSeeds: true,
  showGenerated: true,
  showHull: true,
  showGamut: false,
  showAxes: true,
  morphT: 0,

  toggleSeeds: () => set((s) => ({ showSeeds: !s.showSeeds })),
  toggleGenerated: () => set((s) => ({ showGenerated: !s.showGenerated })),
  toggleHull: () => set((s) => ({ showHull: !s.showHull })),
  toggleGamut: () => set((s) => ({ showGamut: !s.showGamut })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  setMorphT: (t) => set({ morphT: t }),
});
```

- [ ] **Step 3: Create `playbackSlice.ts`**

```ts
import type { StateCreator } from 'zustand';

export interface PlaybackSlice {
  currentFrame: number;
  isPlaying: boolean;
  speed: number; // frames per second

  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlayback: () => void;
  setSpeed: (speed: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
}

export const createPlaybackSlice: StateCreator<PlaybackSlice> = (set) => ({
  currentFrame: 0,
  isPlaying: false,
  speed: 30,

  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlayback: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed }),
  stepForward: () => set((s) => ({ currentFrame: s.currentFrame + 1 })),
  stepBackward: () => set((s) => ({ currentFrame: Math.max(0, s.currentFrame - 1) })),
});
```

- [ ] **Step 4: Create `selectionSlice.ts`**

```ts
import type { StateCreator } from 'zustand';

export interface SelectionSlice {
  selectedIndex: number | null;
  hoveredIndex: number | null;

  setSelectedIndex: (index: number | null) => void;
  setHoveredIndex: (index: number | null) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice> = (set) => ({
  selectedIndex: null,
  hoveredIndex: null,

  setSelectedIndex: (index) => set({ selectedIndex: index }),
  setHoveredIndex: (index) => set({ hoveredIndex: index }),
});
```

- [ ] **Step 5: Create `store/index.ts`**

```ts
import { create } from 'zustand';
import { createPaletteSlice, type PaletteSlice } from './paletteSlice';
import { createViewerSlice, type ViewerSlice } from './viewerSlice';
import { createPlaybackSlice, type PlaybackSlice } from './playbackSlice';
import { createSelectionSlice, type SelectionSlice } from './selectionSlice';

export type AppStore = PaletteSlice & ViewerSlice & PlaybackSlice & SelectionSlice;

export const useStore = create<AppStore>()((...args) => ({
  ...createPaletteSlice(...args),
  ...createViewerSlice(...args),
  ...createPlaybackSlice(...args),
  ...createSelectionSlice(...args),
}));
```

- [ ] **Step 6: Verify compilation**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/store/ && git commit -m "feat(web): add Zustand store with 4 domain slices"
```

---

### Task 3: Coordinate Transforms + Utils

**Files:**
- Create: `apps/web/src/components/viewers/transforms/oklabToScene.ts`
- Create: `apps/web/src/components/viewers/transforms/oklchToScene.ts`
- Create: `apps/web/src/utils/color-format.ts`
- Create: `apps/web/src/__tests__/transforms.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { oklabToScene } from '../components/viewers/transforms/oklabToScene';
import { oklchToScene } from '../components/viewers/transforms/oklchToScene';

describe('oklabToScene', () => {
  it('maps OKLab to Three.js coords (a=x, b=z, L=y)', () => {
    const [x, y, z] = oklabToScene({ L: 0.5, a: 0.1, b: -0.2 });
    expect(x).toBeCloseTo(0.1);  // a → x
    expect(y).toBeCloseTo(0.5);  // L → y
    expect(z).toBeCloseTo(-0.2); // b → z
  });
});

describe('oklchToScene', () => {
  it('maps OKLCh to cylindrical coords (C*cos(h)=x, L=y, C*sin(h)=z)', () => {
    const [x, y, z] = oklchToScene({ L: 0.5, C: 0.1, h: 0 });
    expect(x).toBeCloseTo(0.1);  // C*cos(0) = 0.1
    expect(y).toBeCloseTo(0.5);  // L → y
    expect(z).toBeCloseTo(0);    // C*sin(0) = 0
  });

  it('handles h = π/2', () => {
    const [x, y, z] = oklchToScene({ L: 0.5, C: 0.1, h: Math.PI / 2 });
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(0.1);
  });
});
```

- [ ] **Step 2: Implement transforms**

`oklabToScene.ts`:
```ts
import type { OKLab } from 'facette';
export function oklabToScene(lab: OKLab): [number, number, number] {
  return [lab.a, lab.L, lab.b]; // a→x, L→y, b→z
}
```

`oklchToScene.ts`:
```ts
import type { OKLCh } from 'facette';
export function oklchToScene(lch: OKLCh): [number, number, number] {
  return [lch.C * Math.cos(lch.h), lch.L, lch.C * Math.sin(lch.h)];
}
```

- [ ] **Step 3: Implement `color-format.ts`**

```ts
import type { OKLab, OKLCh } from 'facette';

export function formatOKLab(lab: OKLab): string {
  return `L: ${lab.L.toFixed(3)}, a: ${lab.a.toFixed(3)}, b: ${lab.b.toFixed(3)}`;
}

export function formatOKLCh(lch: OKLCh): string {
  const hDeg = ((lch.h * 180) / Math.PI).toFixed(1);
  return `L: ${lch.L.toFixed(3)}, C: ${lch.C.toFixed(3)}, h: ${hDeg}°`;
}

export function formatRGB(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd apps/web && npx vitest run src/__tests__/transforms.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/viewers/transforms/ apps/web/src/utils/ apps/web/src/__tests__/transforms.test.ts
git commit -m "feat(web): add coordinate transforms and color formatting utils"
```

---

### Task 4: Generate sRGB Gamut Boundary Mesh

**Files:**
- Create: `apps/web/src/assets/srgb-gamut.json`
- Create: `scripts/generate-gamut-mesh.ts` (one-time generator script)

- [ ] **Step 1: Write generation script**

Create `scripts/generate-gamut-mesh.ts` that samples the sRGB gamut boundary in OKLab space:
1. For each hue angle (0 to 2π in ~72 steps) and each lightness (0 to 1 in ~20 steps):
   - Binary search for the maximum chroma that stays in sRGB gamut
   - Record the OKLab point as a vertex
2. Triangulate the surface (connect adjacent hue/lightness samples)
3. Export as JSON: `{ vertices: [x,y,z, x,y,z, ...], indices: [i0,i1,i2, ...] }` where x,y,z are scene coordinates (a, L, b)

The mesh should be ~50KB or less.

- [ ] **Step 2: Run the script to generate the asset**

```bash
npx tsx scripts/generate-gamut-mesh.ts
```

- [ ] **Step 3: Verify the JSON file exists and is reasonable size**

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-gamut-mesh.ts apps/web/src/assets/srgb-gamut.json
git commit -m "feat(web): add precomputed sRGB gamut boundary mesh"
```

---

### Task 5: usePaletteEngine Hook

**Files:**
- Create: `apps/web/src/hooks/usePaletteEngine.ts`

- [ ] **Step 1: Implement the hook**

```ts
import { useCallback } from 'react';
import { createPaletteStepper } from 'facette';
import { useStore } from '../store';

export function usePaletteEngine() {
  const seeds = useStore((s) => s.seeds);
  const paletteSize = useStore((s) => s.paletteSize);
  const vividness = useStore((s) => s.vividness);
  const setTrace = useStore((s) => s.setTrace);
  const setIsComputing = useStore((s) => s.setIsComputing);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setIsPlaying = useStore((s) => s.setIsPlaying);

  const regenerate = useCallback(() => {
    if (seeds.length < 2) return;

    setIsComputing(true);
    setIsPlaying(false);

    try {
      const options = vividness > 0 ? { vividness } : undefined;
      const stepper = createPaletteStepper(seeds, paletteSize, options);
      const trace = stepper.run();
      setTrace(trace);
      setCurrentFrame(0);
    } catch (e) {
      console.error('Palette generation failed:', e);
      setTrace(null);
    } finally {
      setIsComputing(false);
    }
  }, [seeds, paletteSize, vividness, setTrace, setIsComputing, setCurrentFrame, setIsPlaying]);

  return { regenerate };
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/usePaletteEngine.ts
git commit -m "feat(web): add usePaletteEngine hook connecting store to facette core"
```

---

### Task 6: usePlayback Hook

**Files:**
- Create: `apps/web/src/hooks/usePlayback.ts`

- [ ] **Step 1: Implement**

```ts
import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function usePlayback() {
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const trace = useStore((s) => s.trace);

  const lastTimeRef = useRef(0);
  const frameAccRef = useRef(0);

  useEffect(() => {
    if (!isPlaying || !trace) return;

    const totalFrames = trace.frames.length;
    lastTimeRef.current = 0;
    frameAccRef.current = 0;

    const tick = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      frameAccRef.current += delta * useStore.getState().speed;
      const framesToAdvance = Math.floor(frameAccRef.current);
      frameAccRef.current -= framesToAdvance;

      if (framesToAdvance > 0) {
        // Read currentFrame imperatively to avoid stale closure
        const current = useStore.getState().currentFrame;
        const next = current + framesToAdvance;
        if (next >= totalFrames) {
          useStore.getState().setCurrentFrame(totalFrames - 1);
          useStore.getState().setIsPlaying(false);
          return;
        }
        useStore.getState().setCurrentFrame(next);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const rafRef = { current: requestAnimationFrame(tick) };

    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, trace]); // No currentFrame in deps — read imperatively
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/usePlayback.ts
git commit -m "feat(web): add usePlayback hook for animation loop"
```

---

### Task 7: useMorphInterpolation Hook

**Files:**
- Create: `apps/web/src/hooks/useMorphInterpolation.ts`

- [ ] **Step 1: Implement**

The hook reads `morphT` from the viewer slice and the current frame from the trace. It returns interpolated positions for each particle.

```ts
import { useMemo } from 'react';
import { useStore } from '../store';
import type { OKLab, Particle } from 'facette';

function lerpOKLab(a: OKLab, b: OKLab, t: number): OKLab {
  return {
    L: a.L + (b.L - a.L) * t,
    a: a.a + (b.a - a.a) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function useMorphInterpolation(): {
  particles: Particle[];
  interpolatedPositions: OKLab[];
} | null {
  const trace = useStore((s) => s.trace);
  const currentFrame = useStore((s) => s.currentFrame);
  const morphT = useStore((s) => s.morphT);

  return useMemo(() => {
    if (!trace || currentFrame >= trace.frames.length) return null;
    const frame = trace.frames[currentFrame];
    const interpolated = frame.particles.map((p, i) =>
      lerpOKLab(p.position, frame.warpedPositions[i], morphT)
    );
    return { particles: frame.particles, interpolatedPositions: interpolated };
  }, [trace, currentFrame, morphT]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useMorphInterpolation.ts
git commit -m "feat(web): add useMorphInterpolation hook for warped/unwarped lerp"
```

---

### Task 8: SceneSetup + AxisHelper (Foundation 3D)

**Files:**
- Create: `apps/web/src/components/viewers/shared/SceneSetup.tsx`
- Create: `apps/web/src/components/viewers/shared/AxisHelper.tsx`

- [ ] **Step 1: Implement SceneSetup**

R3F Canvas wrapper with orbit controls, ambient + directional light, perspective camera.

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { type ReactNode, forwardRef } from 'react';

interface SceneSetupProps {
  children: ReactNode;
  orbitRef?: React.Ref<any>;
}

export function SceneSetup({ children, orbitRef }: SceneSetupProps) {
  return (
    <Canvas camera={{ position: [1.5, 1.5, 1.5], fov: 50, near: 0.01, far: 100 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <OrbitControls ref={orbitRef} makeDefault />
      {children}
    </Canvas>
  );
}
```

- [ ] **Step 2: Implement AxisHelper**

Renders labeled axes (L, a, b or L, C, h) using drei's Line and Text.

```tsx
import { Line, Text } from '@react-three/drei';

interface AxisHelperProps {
  labels?: [string, string, string]; // default ['a', 'L', 'b']
  size?: number;
}

export function AxisHelper({ labels = ['a', 'L', 'b'], size = 0.5 }: AxisHelperProps) {
  return (
    <group>
      {/* X axis (red) */}
      <Line points={[[0,0,0], [size,0,0]]} color="red" lineWidth={1.5} />
      <Text position={[size + 0.05, 0, 0]} fontSize={0.04} color="red">{labels[0]}</Text>
      {/* Y axis (green) */}
      <Line points={[[0,0,0], [0,size,0]]} color="green" lineWidth={1.5} />
      <Text position={[0, size + 0.05, 0]} fontSize={0.04} color="green">{labels[1]}</Text>
      {/* Z axis (blue) */}
      <Line points={[[0,0,0], [0,0,size]]} color="blue" lineWidth={1.5} />
      <Text position={[0, 0, size + 0.05]} fontSize={0.04} color="blue">{labels[2]}</Text>
    </group>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/viewers/shared/SceneSetup.tsx apps/web/src/components/viewers/shared/AxisHelper.tsx
git commit -m "feat(web): add SceneSetup and AxisHelper 3D components"
```

---

### Task 9: ParticlePoints + HullMesh

**Files:**
- Create: `apps/web/src/components/viewers/shared/ParticlePoints.tsx`
- Create: `apps/web/src/components/viewers/shared/HullMesh.tsx`

- [ ] **Step 1: Implement ParticlePoints**

Renders seed spheres (larger, outlined) and free particle spheres (smaller). Clickable — sets selectedIndex in store. Uses `positionMapper` prop for coordinate transform.

```tsx
import { type Particle, type OKLab } from 'facette';
import { useStore } from '../../../store';

interface ParticlePointsProps {
  particles: Particle[];
  positions: OKLab[];           // interpolated positions (morphed)
  positionMapper: (pos: OKLab) => [number, number, number];
  colors: string[];             // hex colors for each particle
}

export function ParticlePoints({ particles, positions, positionMapper, colors }: ParticlePointsProps) {
  const selectedIndex = useStore((s) => s.selectedIndex);
  const setSelectedIndex = useStore((s) => s.setSelectedIndex);
  const setHoveredIndex = useStore((s) => s.setHoveredIndex);
  const showSeeds = useStore((s) => s.showSeeds);
  const showGenerated = useStore((s) => s.showGenerated);

  return (
    <group>
      {particles.map((p, i) => {
        const isSeed = p.kind.startsWith('pinned');
        if (isSeed && !showSeeds) return null;
        if (!isSeed && !showGenerated) return null;

        const pos = positionMapper(positions[i]);
        const radius = isSeed ? 0.015 : 0.01;
        const isSelected = selectedIndex === i;

        return (
          <mesh
            key={i}
            position={pos}
            onClick={(e) => { e.stopPropagation(); setSelectedIndex(i); }}
            onPointerEnter={() => setHoveredIndex(i)}
            onPointerLeave={() => setHoveredIndex(null)}
          >
            <sphereGeometry args={[isSelected ? radius * 1.5 : radius, 16, 16]} />
            <meshStandardMaterial color={colors[i] ?? '#ffffff'} />
          </mesh>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 2: Implement HullMesh**

Renders the convex hull as wireframe lines. Uses `positionMapper` for coordinate transform.

```tsx
import { Line } from '@react-three/drei';
import type { HullGeometry, OKLab } from 'facette';

interface HullMeshProps {
  hull: HullGeometry;
  positions: OKLab[];   // hull vertex positions (possibly morphed)
  positionMapper: (pos: OKLab) => [number, number, number];
}

export function HullMesh({ hull, positions, positionMapper }: HullMeshProps) {
  // Build edge list from faces (deduplicate)
  const edges = new Set<string>();
  const edgePoints: [number, number][] = [];

  for (const face of hull.faces) {
    const [a, b, c] = face.vertexIndices;
    for (const [i, j] of [[a,b], [b,c], [c,a]]) {
      const key = Math.min(i,j) + '-' + Math.max(i,j);
      if (!edges.has(key)) {
        edges.add(key);
        edgePoints.push([i, j]);
      }
    }
  }

  return (
    <group>
      {edgePoints.map(([i, j], idx) => (
        <Line
          key={idx}
          points={[positionMapper(positions[i]), positionMapper(positions[j])]}
          color="#666666"
          lineWidth={1}
          opacity={0.6}
          transparent
        />
      ))}
    </group>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/viewers/shared/ParticlePoints.tsx apps/web/src/components/viewers/shared/HullMesh.tsx
git commit -m "feat(web): add ParticlePoints and HullMesh shared 3D components"
```

---

### Task 10: GamutBoundary + MorphAnimator

**Files:**
- Create: `apps/web/src/components/viewers/shared/GamutBoundary.tsx`
- Create: `apps/web/src/components/viewers/shared/MorphAnimator.tsx`

- [ ] **Step 1: Implement GamutBoundary**

Loads the precomputed gamut mesh JSON and renders as semi-transparent wireframe.

```tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import gamutData from '../../../assets/srgb-gamut.json';

interface GamutBoundaryProps {
  positionMapper?: (pos: { L: number; a: number; b: number }) => [number, number, number];
}

export function GamutBoundary({ positionMapper }: GamutBoundaryProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // If positionMapper is provided, remap vertices
    const verts = positionMapper
      ? remapVertices(gamutData.vertices, positionMapper)
      : new Float32Array(gamutData.vertices);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(gamutData.indices);
    return geo;
  }, [positionMapper]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="#444444" wireframe transparent opacity={0.15} />
    </mesh>
  );
}

function remapVertices(
  flat: number[],
  mapper: (pos: { L: number; a: number; b: number }) => [number, number, number]
): Float32Array {
  const result = new Float32Array(flat.length);
  for (let i = 0; i < flat.length; i += 3) {
    // Vertices stored as [a, L, b] in scene coords → convert back to OKLab
    const [x, y, z] = mapper({ L: flat[i + 1], a: flat[i], b: flat[i + 2] });
    result[i] = x;
    result[i + 1] = y;
    result[i + 2] = z;
  }
  return result;
}
```

- [ ] **Step 2: Implement MorphAnimator (exports `useMorphToggle` hook)**

Note: Despite the file name `MorphAnimator.tsx`, this exports a hook (`useMorphToggle`) that manages the smooth tween. The name reflects its role in the shared viewer component directory. Components use `useMorphToggle()` to get the toggle function and current morph state.

```tsx
import { useRef, useEffect } from 'react';
import { useStore } from '../../../store';

export function useMorphToggle() {
  const morphT = useStore((s) => s.morphT);
  const setMorphT = useStore((s) => s.setMorphT);
  const targetRef = useRef(0);
  const animRef = useRef<number | null>(null);

  const toggle = () => {
    targetRef.current = morphT < 0.5 ? 1 : 0;
    const animate = () => {
      const current = useStore.getState().morphT;
      const target = targetRef.current;
      const diff = target - current;
      if (Math.abs(diff) < 0.01) {
        setMorphT(target);
        return;
      }
      setMorphT(current + diff * 0.1);
      animRef.current = requestAnimationFrame(animate);
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return { morphT, toggle, isWarped: morphT > 0.5 };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/viewers/shared/GamutBoundary.tsx apps/web/src/components/viewers/shared/MorphAnimator.tsx
git commit -m "feat(web): add GamutBoundary and morph toggle for warped/unwarped animation"
```

---

### Task 11: OKLabViewer + OKLChViewer + useSyncedCamera

**Files:**
- Create: `apps/web/src/components/viewers/OKLabViewer.tsx`
- Create: `apps/web/src/components/viewers/OKLChViewer.tsx`
- Create: `apps/web/src/hooks/useSyncedCamera.ts`

- [ ] **Step 1: Implement useSyncedCamera**

Syncs orbit controls between two R3F canvases using refs (not store state — camera updates at 60fps would cause unnecessary re-renders). Pass orbit control refs from both viewers, sync camera position/target/up on each frame via useFrame.

- [ ] **Step 2: Implement OKLabViewer**

Left panel. Composes SceneSetup + shared components with `oklabToScene` position mapper. Includes morph toggle button overlay. Label: "OKLab" or "Warped OKLab" based on morph state.

Note: positionMapper takes `OKLab` (not `Particle`) — positions are pre-extracted by useMorphInterpolation. This simplifies the shared component interface vs. the design spec's `(particle: Particle) => [x,y,z]` pattern.

Note: HullMesh needs hull vertex positions mapped from particle positions. Build a lookup: for each hull vertex index, find the particle with `kind: 'pinned-vertex'` and `vertexIndex` matching, then use its morphed position. Alternatively, morph hull vertices directly by applying the warp transform to each hull vertex OKLab position and lerping with morphT. Use the latter approach (simpler — hull vertices are always the same as their OKLab positions).

- [ ] **Step 3: Implement OKLChViewer**

Right panel. Same structure with `oklchToScene` position mapper. Labels: "L", "C", "h". Applies same morph interpolation in cylindrical space.

- [ ] **Step 4: Verify both viewers render (update App.tsx temporarily)**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/viewers/ apps/web/src/hooks/useSyncedCamera.ts
git commit -m "feat(web): add OKLab and OKLCh dual 3D viewers with camera sync"
```

---

### Task 12: Control Components

**Files:**
- Create: `apps/web/src/components/controls/SeedEditor.tsx`
- Create: `apps/web/src/components/controls/PaletteControls.tsx`
- Create: `apps/web/src/components/controls/PlaybackControls.tsx`
- Create: `apps/web/src/components/controls/LayerToggles.tsx`

- [ ] **Step 1: Implement SeedEditor**

Color pickers for each seed. Add/remove buttons. Calls `usePaletteEngine().regenerate` on change.

- [ ] **Step 2: Implement PaletteControls**

N slider (range 2-20), vividness slider (0-0.10, 0=auto), regenerate button.

- [ ] **Step 3: Implement PlaybackControls**

Play/pause button, step forward/back, iteration scrubber (range input), speed slider, frame counter display.

- [ ] **Step 4: Implement LayerToggles**

Checkboxes for: seeds, generated, hull, gamut, axes. Morph toggle button.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/controls/
git commit -m "feat(web): add seed editor, palette controls, playback, and layer toggles"
```

---

### Task 13: Info Panels + PaletteStrip

**Files:**
- Create: `apps/web/src/components/info/PointInfoPanel.tsx`
- Create: `apps/web/src/components/info/EnergyGraph.tsx`
- Create: `apps/web/src/components/palette/PaletteStrip.tsx`

- [ ] **Step 1: Implement PointInfoPanel**

Shows selected point details: color swatch, OKLCh values, OKLab values, warped OKLab values, sRGB hex + RGB. Reads from selectionSlice + current frame.

- [ ] **Step 2: Implement EnergyGraph**

Canvas-based line chart showing energy over all iterations. Highlights current frame with a vertical line. Uses raw `<canvas>` element with 2D context (no chart library).

- [ ] **Step 3: Implement PaletteStrip**

Horizontal row of color swatches showing the current palette (from trace.finalColors or current frame colors). Clickable to select a point.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/info/ apps/web/src/components/palette/
git commit -m "feat(web): add point info panel, energy graph, and palette strip"
```

---

### Task 14: DashboardLayout + App Assembly

**Files:**
- Create: `apps/web/src/components/layout/DashboardLayout.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Implement DashboardLayout**

CSS grid layout:
```
┌─────────────────────────────────────────────┐
│  Controls Bar (seeds, palette, playback)    │
├───────────────────────┬─────────────────────┤
│  OKLab Viewer (left)  │ OKLCh Viewer (right)│
├───────────────────────┴─────────────────────┤
│  Info: PointInfo │ EnergyGraph │ PaletteStrip│
└─────────────────────────────────────────────┘
```

```tsx
export function DashboardLayout() {
  return (
    <div className="h-screen grid grid-rows-[auto_1fr_auto] gap-1 p-2">
      {/* Top: controls */}
      <div className="flex gap-4 items-start bg-gray-900 rounded-lg p-3">
        <SeedEditor />
        <PaletteControls />
        <PlaybackControls />
        <LayerToggles />
      </div>

      {/* Middle: dual 3D viewers */}
      <div className="grid grid-cols-2 gap-1">
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <OKLabViewer />
        </div>
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <OKLChViewer />
        </div>
      </div>

      {/* Bottom: info panels */}
      <div className="flex gap-2 bg-gray-900 rounded-lg p-3">
        <PointInfoPanel />
        <EnergyGraph />
        <PaletteStrip />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx**

Wire DashboardLayout with initial palette generation on mount.

```tsx
import { useEffect } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { usePaletteEngine } from './hooks/usePaletteEngine';
import { usePlayback } from './hooks/usePlayback';

export default function App() {
  const { regenerate } = usePaletteEngine();
  usePlayback();

  useEffect(() => {
    regenerate();
  }, []);

  return <DashboardLayout />;
}
```

- [ ] **Step 3: Verify the full app renders**

```bash
cd apps/web && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/ apps/web/src/App.tsx
git commit -m "feat(web): add dashboard layout and wire up full app"
```

---

### Task 15: Webapp Tests

**Files:**
- Create: `apps/web/src/__tests__/store.test.ts`
- Create: `apps/web/src/__tests__/usePaletteEngine.test.ts`

- [ ] **Step 1: Write store tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

// Reset store between tests to prevent cross-test state leaks
beforeEach(() => {
  useStore.setState({
    seeds: ['#e63946', '#457b9d', '#1d3557'],
    paletteSize: 8,
    vividness: 0,
    trace: null,
    isComputing: false,
    showSeeds: true,
    showGenerated: true,
    showHull: true,
    showGamut: false,
    showAxes: true,
    morphT: 0,
    currentFrame: 0,
    isPlaying: false,
    speed: 30,
    selectedIndex: null,
    hoveredIndex: null,
  });
});

describe('paletteSlice', () => {
  it('has default seeds', () => {
    const state = useStore.getState();
    expect(state.seeds.length).toBeGreaterThan(0);
  });

  it('addSeed appends', () => {
    useStore.getState().addSeed('#ff0000');
    expect(useStore.getState().seeds).toContain('#ff0000');
  });

  it('removeSeed removes by index', () => {
    const initial = useStore.getState().seeds.length;
    useStore.getState().removeSeed(0);
    expect(useStore.getState().seeds.length).toBe(initial - 1);
  });

  it('updateSeed replaces at index', () => {
    useStore.getState().setSeeds(['#aaa', '#bbb']);
    useStore.getState().updateSeed(1, '#ccc');
    expect(useStore.getState().seeds[1]).toBe('#ccc');
  });
});

describe('playbackSlice', () => {
  it('togglePlayback flips state', () => {
    useStore.getState().setIsPlaying(false);
    useStore.getState().togglePlayback();
    expect(useStore.getState().isPlaying).toBe(true);
  });

  it('stepForward increments frame', () => {
    useStore.getState().setCurrentFrame(5);
    useStore.getState().stepForward();
    expect(useStore.getState().currentFrame).toBe(6);
  });

  it('stepBackward does not go below 0', () => {
    useStore.getState().setCurrentFrame(0);
    useStore.getState().stepBackward();
    expect(useStore.getState().currentFrame).toBe(0);
  });
});

describe('viewerSlice', () => {
  it('toggles layers', () => {
    const before = useStore.getState().showHull;
    useStore.getState().toggleHull();
    expect(useStore.getState().showHull).toBe(!before);
  });

  it('sets morphT', () => {
    useStore.getState().setMorphT(0.5);
    expect(useStore.getState().morphT).toBe(0.5);
  });
});

describe('selectionSlice', () => {
  it('sets selected index', () => {
    useStore.getState().setSelectedIndex(3);
    expect(useStore.getState().selectedIndex).toBe(3);
  });

  it('clears selection', () => {
    useStore.getState().setSelectedIndex(null);
    expect(useStore.getState().selectedIndex).toBeNull();
  });
});
```

- [ ] **Step 2: Write usePaletteEngine tests**

```ts
// apps/web/src/__tests__/usePaletteEngine.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';
import { createPaletteStepper } from 'facette';

describe('usePaletteEngine integration', () => {
  beforeEach(() => {
    useStore.setState({ seeds: ['#ff0000', '#0000ff'], paletteSize: 4, vividness: 0, trace: null });
  });

  it('createPaletteStepper produces trace from store seeds', () => {
    const { seeds, paletteSize } = useStore.getState();
    const stepper = createPaletteStepper(seeds, paletteSize);
    const trace = stepper.run();
    expect(trace.frames.length).toBeGreaterThan(0);
    expect(trace.finalColors.length).toBe(4);
  });

  it('trace stored in state is accessible', () => {
    const { seeds, paletteSize } = useStore.getState();
    const stepper = createPaletteStepper(seeds, paletteSize);
    const trace = stepper.run();
    useStore.getState().setTrace(trace);
    expect(useStore.getState().trace).toBe(trace);
    expect(useStore.getState().trace!.finalColors.length).toBe(4);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && npx vitest run
```

- [ ] **Step 4: Run full monorepo tests**

```bash
cd C:/Users/yves-/code/Facette && pnpm turbo test
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/__tests__/store.test.ts
git commit -m "feat(web): add Zustand store tests"
```

---

## Completion

After all 15 tasks are done, the webapp:
- Renders a full debug dashboard with dual 3D viewers
- Supports interactive seed editing with live regeneration
- Plays back optimization animation frame by frame
- Morphs smoothly between warped and unwarped OKLab space
- Shows sRGB gamut boundary, hull wireframe, axes (all toggleable)
- Displays selected point info (OKLab, OKLCh, warped, sRGB)
- Shows energy graph with current frame indicator
- Runs via `pnpm turbo dev` (core in watch + web dev server)
