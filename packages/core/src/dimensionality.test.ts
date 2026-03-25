import { describe, it, expect } from 'vitest';
import { detectDimensionality } from './dimensionality';
import type { OKLab } from './types';

describe('dimensionality detection', () => {
  it('returns 0 for identical points', () => {
    const seeds: OKLab[] = [
      { L: 0.5, a: 0.1, b: 0.1 },
      { L: 0.5, a: 0.1, b: 0.1 },
    ];
    expect(detectDimensionality(seeds).dimension).toBe(0);
  });

  it('returns 1 for collinear points (2 seeds on L axis)', () => {
    const seeds: OKLab[] = [
      { L: 0.2, a: 0, b: 0 },
      { L: 0.8, a: 0, b: 0 },
    ];
    expect(detectDimensionality(seeds).dimension).toBe(1);
  });

  it('returns 1 for 3 collinear points', () => {
    const seeds: OKLab[] = [
      { L: 0.2, a: 0.1, b: 0.1 },
      { L: 0.5, a: 0.25, b: 0.25 },
      { L: 0.8, a: 0.4, b: 0.4 },
    ];
    expect(detectDimensionality(seeds).dimension).toBe(1);
  });

  it('returns 2 for coplanar points', () => {
    const seeds: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
    ];
    expect(detectDimensionality(seeds).dimension).toBe(2);
  });

  it('returns 3 for full 3D points', () => {
    const seeds: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
      { L: 0, a: 0, b: 1 },
    ];
    expect(detectDimensionality(seeds).dimension).toBe(3);
  });

  it('returns 2 for near-coplanar points (tiny σ₃)', () => {
    const seeds: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 1, b: 0 },
      { L: 0.5, a: 0.5, b: 1e-8 },
    ];
    expect(detectDimensionality(seeds).dimension).toBe(2);
  });

  it('returns singular values sorted descending', () => {
    const seeds: OKLab[] = [
      { L: 0, a: 0, b: 0 },
      { L: 1, a: 0, b: 0 },
      { L: 0, a: 0.5, b: 0 },
      { L: 0, a: 0, b: 0.3 },
    ];
    const { singularValues } = detectDimensionality(seeds);
    for (let i = 1; i < singularValues.length; i++) {
      expect(singularValues[i - 1]).toBeGreaterThanOrEqual(singularValues[i] - 1e-10);
    }
  });
});
