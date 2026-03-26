# Changelog

All notable changes to the `facette` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-03-27

### Fixed

- Coplanar hull now uses single-sided faces and only includes hull vertices, fixing incorrect geometry for 3+ coplanar seeds
- Optimization stepper no longer has a hardcoded iteration cap that could override the annealing schedule's convergence criteria

## [0.1.0] - 2026-03-27

Initial release with V5 unified radial lift architecture.

### Added

- `generatePalette(seeds, size, options?)` — generate a perceptually distinct color palette from seed colors
- `createPaletteStepper(seeds, size, options?)` — step through the optimization frame by frame
- `gamma` option for controlling chroma preservation on intermediate colors between vivid seeds
- `vividness` option for controlling gray avoidance strength (auto by default)
- Radial lift transform `rho(r) = R * (f(r)/f(R))^gamma` with closed-form inverse
- Convex hull construction with automatic dimensionality detection (1D/2D/3D)
- Riesz energy optimization with exponent continuation (p: 2 → 6)
- Gamut penalty via finite differences through inverse lift
- Deterministic greedy particle initialization with exact face areas
- Face atlas with edge-crossing logic for particle movement on hull surface
- Gamut clipping preserving hue and lightness (Bottosson's method)
- Full OKLab/OKLCh/sRGB color conversion pipeline

### Algorithm

- Hull, atlas, and optimization all operate in a single lifted space — no geometry/physics split
- Gray avoidance emerges from lift geometry (contracted low-chroma region) — no separate energy term
- Chroma preservation guaranteed by convexity of the lift function (Jensen's inequality)
- Plain Euclidean forces on flat faces — no warp Jacobian, no pullback
- Face areas are exact (flat faces in lifted space) — no subdivision approximation
