import { describe, it, expect } from 'vitest';
import { computeBarycentric, interpolate, isValid, clampAndRenormalize } from './barycentric';
import type { OKLab, Barycentric } from './types';

describe('barycentric', () => {
  const v0: OKLab = { L: 0, a: 0, b: 0 };
  const v1: OKLab = { L: 1, a: 0, b: 0 };
  const v2: OKLab = { L: 0, a: 1, b: 0 };

  it('vertex v0 maps to (1,0,0)', () => {
    const b = computeBarycentric(v0, v0, v1, v2);
    expect(b.w0).toBeCloseTo(1);
    expect(b.w1).toBeCloseTo(0);
    expect(b.w2).toBeCloseTo(0);
  });

  it('vertex v1 maps to (0,1,0)', () => {
    const b = computeBarycentric(v1, v0, v1, v2);
    expect(b.w0).toBeCloseTo(0);
    expect(b.w1).toBeCloseTo(1);
    expect(b.w2).toBeCloseTo(0);
  });

  it('centroid maps to (1/3, 1/3, 1/3)', () => {
    const centroid: OKLab = { L: 1/3, a: 1/3, b: 0 };
    const b = computeBarycentric(centroid, v0, v1, v2);
    expect(b.w0).toBeCloseTo(1/3);
    expect(b.w1).toBeCloseTo(1/3);
    expect(b.w2).toBeCloseTo(1/3);
  });

  it('interpolate reconstructs the point', () => {
    const bary: Barycentric = { w0: 0.5, w1: 0.3, w2: 0.2 };
    const p = interpolate(bary, v0, v1, v2);
    expect(p.L).toBeCloseTo(0.3);
    expect(p.a).toBeCloseTo(0.2);
    expect(p.b).toBeCloseTo(0);
  });

  it('round-trip: computeBarycentric then interpolate', () => {
    const p: OKLab = { L: 0.4, a: 0.3, b: 0 };
    const bary = computeBarycentric(p, v0, v1, v2);
    const reconstructed = interpolate(bary, v0, v1, v2);
    expect(reconstructed.L).toBeCloseTo(p.L);
    expect(reconstructed.a).toBeCloseTo(p.a);
    expect(reconstructed.b).toBeCloseTo(p.b);
  });

  it('isValid returns true for valid coords', () => {
    expect(isValid({ w0: 0.5, w1: 0.3, w2: 0.2 })).toBe(true);
  });

  it('isValid returns false for negative coord', () => {
    expect(isValid({ w0: -0.1, w1: 0.5, w2: 0.6 })).toBe(false);
  });

  it('isValid returns false for sum != 1', () => {
    expect(isValid({ w0: 0.5, w1: 0.5, w2: 0.5 })).toBe(false);
  });

  it('clampAndRenormalize fixes negative coords', () => {
    const b = clampAndRenormalize({ w0: -0.1, w1: 0.6, w2: 0.5 });
    expect(b.w0).toBeGreaterThanOrEqual(0);
    expect(b.w1).toBeGreaterThanOrEqual(0);
    expect(b.w2).toBeGreaterThanOrEqual(0);
    expect(b.w0 + b.w1 + b.w2).toBeCloseTo(1);
  });

  it('clampAndRenormalize preserves valid coords', () => {
    const original: Barycentric = { w0: 0.3, w1: 0.3, w2: 0.4 };
    const b = clampAndRenormalize(original);
    expect(b.w0).toBeCloseTo(original.w0);
    expect(b.w1).toBeCloseTo(original.w1);
    expect(b.w2).toBeCloseTo(original.w2);
  });
});
