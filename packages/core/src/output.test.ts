import { describe, it, expect } from 'vitest';
import { finalizeColors } from './output';
import { createGamutChecker } from './gamut-clipping';
import type { Particle } from './types';

describe('finalizeColors', () => {
  const gamut = createGamutChecker();

  it('returns correct number of colors', () => {
    const particles: Particle[] = [
      { kind: 'pinned-vertex', position: { L: 0.5, a: 0, b: 0 }, vertexIndex: 0 },
      { kind: 'free', position: { L: 0.7, a: 0.05, b: 0 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const { colors } = finalizeColors(particles, gamut);
    expect(colors.length).toBe(2);
  });

  it('all outputs are valid hex strings', () => {
    const particles: Particle[] = [
      { kind: 'pinned-vertex', position: { L: 0.5, a: 0, b: 0 }, vertexIndex: 0 },
      { kind: 'free', position: { L: 0.7, a: 0.05, b: 0.02 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const { colors } = finalizeColors(particles, gamut);
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('in-gamut colors are not clipped', () => {
    const particles: Particle[] = [
      { kind: 'pinned-vertex', position: { L: 0.5, a: 0, b: 0 }, vertexIndex: 0 },
    ];
    const { clippedIndices } = finalizeColors(particles, gamut);
    expect(clippedIndices.length).toBe(0);
  });

  it('out-of-gamut colors are clipped and recorded', () => {
    const particles: Particle[] = [
      { kind: 'free', position: { L: 0.5, a: 0.4, b: 0.4 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const { colors, clippedIndices } = finalizeColors(particles, gamut);
    expect(clippedIndices).toContain(0);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('clipped colors are valid (in gamut after clipping)', () => {
    const particles: Particle[] = [
      { kind: 'free', position: { L: 0.5, a: 0.3, b: 0.3 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
    ];
    const { colors } = finalizeColors(particles, gamut);
    // Just verify it produces a valid hex — the clipping logic is tested in gamut-clipping.test.ts
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('handles mixed in-gamut and out-of-gamut', () => {
    const particles: Particle[] = [
      { kind: 'pinned-vertex', position: { L: 0.5, a: 0, b: 0 }, vertexIndex: 0 },
      { kind: 'free', position: { L: 0.5, a: 0.4, b: 0.4 }, faceIndex: 0, bary: { w0: 1/3, w1: 1/3, w2: 1/3 } },
      { kind: 'pinned-vertex', position: { L: 0.7, a: 0.05, b: 0 }, vertexIndex: 1 },
    ];
    const { colors, clippedIndices } = finalizeColors(particles, gamut);
    expect(colors.length).toBe(3);
    expect(clippedIndices).toContain(1); // second particle was out of gamut
    expect(clippedIndices).not.toContain(0);
    expect(clippedIndices).not.toContain(2);
  });
});
