# Clipping Visualization Design

## Problem

The 3D viewer shows palette points at their unclipped OKLab positions, colored with clipped hex values from `trace.finalColors`. There is no way to see where points land after gamut clipping, or which points were clipped. The user needs to visualize the effect of gamut clipping directly in the 3D viewer.

## Requirements

1. **Clipping toggle** snaps point positions in the 3D viewer to their gamut-clipped OKLab coordinates.
2. **Unlifted-only** — the toggle is disabled/hidden when the viewer is in lifted mode (`morphT > 0`). Clipping is an OKLab-space operation and has no meaning in lifted space.
3. **Frame behavior** — toggling clipping on jumps playback to the last frame. Scrubbing to a different frame disables clipping automatically.
4. **Visual distinction** — points that were clipped (moved by gamut mapping) are visually distinguished from in-gamut points when clipping mode is active.
5. **PointInfoPanel** — always shows both clipped and unclipped OKLab/OKLCh/hex values for the selected point, independent of the toggle state.

## Design

### 1. Core: Capture clipped positions in `finalizeColors`

**File:** `packages/core/src/output.ts`

`finalizeColors()` already computes `clipPreserveChroma(pos)` for out-of-gamut points, converts to hex, then discards the intermediate OKLab. Change it to also return the clipped OKLab positions:

- Add `clippedPositions: OKLab[]` to the return type — same length as input `positions[]`.
- In-gamut points: `clippedPositions[i] = positions[i]` (identity).
- Out-of-gamut points: `clippedPositions[i] = gamut.clipPreserveChroma(positions[i])`.

No new computation — just capturing the intermediate result that is currently discarded.

**File:** `packages/core/src/types.ts`

Add `clippedPositions: OKLab[]` to `OptimizationTrace`.

**File:** `packages/core/src/facette.ts` (~line 263)

Destructure `clippedPositions` from `finalizeColors()` and include it in the trace object.

### 2. Store: Pure `showClipping` toggle

**File:** `apps/web/src/store/viewerSlice.ts`

Add to `ViewerSlice`:
- `showClipping: boolean` (default `false`)
- `toggleClipping: () => void` — pure boolean flip, no side effects. The store holds state; it does not coordinate across slices.

### 3. Hook: `useClippingInterlock` — cross-slice coordination

**File:** `apps/web/src/hooks/useClippingInterlock.ts`

A React hook that owns all interlock logic between `showClipping`, `currentFrame`, and `morphT`. This keeps store slices independent (SRP) and avoids viewerSlice reaching into playbackSlice (LoD).

Behavior:

- **On showClipping turning on**: jump `currentFrame` to last frame, set `morphT` to 0 if lifted.
- **On currentFrame changing** away from last frame while `showClipping` is true: set `showClipping` to false.
- **On morphT leaving 0** while `showClipping` is true: set `showClipping` to false.

Mounted once in the app (or in the viewer layout). Uses `useEffect` reacting to store values via selectors.

### 4. Hook: Extend `useMorphInterpolation` for clipping positions

**File:** `apps/web/src/hooks/useMorphInterpolation.ts`

When `showClipping` is true (and on last frame, unlifted), return `trace.clippedPositions` instead of interpolated positions. Both OKLabViewer and OKLChViewer already consume this hook — zero duplication (DRY). The viewers do not need any position-swapping logic of their own.

### 5. Visual distinction for clipped points

**File:** `apps/web/src/components/viewers/shared/ParticlePoints.tsx`

When `showClipping` is active, points whose index appears in `trace.clippedIndices` receive a visual marker: a second, slightly larger (1.8x radius) wireframe sphere rendered behind the solid sphere, colored semi-transparent white (`#ffffff` at 40% opacity). This creates a visible ring effect without altering the point's palette color.

`ParticlePoints` receives a new optional prop `clippedIndices: Set<number> | null`. When non-null, the component renders the wireframe ring for indices in the set.

### 6. PointInfoPanel: Always show both values

**File:** `apps/web/src/components/info/PointInfoPanel.tsx`

Always display both clipped and unclipped color info for the selected point:
- Read `trace.clippedPositions[selectedIndex]` and `frame.oklabPositions[selectedIndex]`.
- Compare them: if they differ, the point was clipped.
- Show the unclipped OKLab/OKLCh/hex as currently done.
- Below it, show the clipped OKLab/OKLCh/hex with a label like "Clipped:" and a visual indicator (e.g., the clipped color swatch next to the original).
- If the point was not clipped, show a single section or a note like "In gamut" to avoid redundancy.

Note: clipped values are only available for the last frame (since `trace.clippedPositions` is computed from the final optimization result). When viewing earlier frames, omit the clipped section.

### 7. UI: Toggle placement

**File:** `apps/web/src/components/controls/LayerToggles.tsx`

Add "Clipping" to the existing toggles array. When `morphT > 0` (lifted mode), the checkbox is disabled with reduced opacity and a title tooltip explaining it's only available in unlifted mode.

## Data flow summary

```
finalizeColors() → { colors, clippedIndices, clippedPositions }
       ↓
OptimizationTrace.clippedPositions (new field)
       ↓
viewerSlice: showClipping (pure boolean toggle)
       ↓
useClippingInterlock: coordinates frame/morph side effects
       ↓
useMorphInterpolation: returns clippedPositions when showClipping is active (DRY)
       ↓
ParticlePoints: clippedIndices prop → ring on clipped points
       ↓
PointInfoPanel: always shows both clipped/unclipped values
```

## Testing

- **Core unit test**: `finalizeColors` returns correct `clippedPositions` — identity for in-gamut, clipped OKLab for out-of-gamut.
- **Interlock hook test**: `useClippingInterlock` jumps to last frame on activation, auto-disables on frame change or morph change.
- **PointInfoPanel test**: Renders both clipped and unclipped values when point is clipped; shows "In gamut" when not.
- **Visual/manual**: Run dev server, generate a palette with out-of-gamut points, toggle clipping, verify points snap to gamut boundary and clipped points show rings.
