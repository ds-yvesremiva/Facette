import { describe, it, expect } from 'vitest';
import { generatePalette } from '../facette';
import { hexToOklab } from '../color-conversion';
import type { OKLab } from '../types';

function chroma(lab: OKLab): number {
  return Math.sqrt(lab.a ** 2 + lab.b ** 2);
}

function hue(lab: OKLab): number {
  return Math.atan2(lab.b, lab.a);
}

describe('Section 12 Integration Benchmarks', () => {
  it('line segment: 2 vivid complementary', () => {
    const result = generatePalette(['#e63946', '#2a9d8f'], 6);
    expect(result.colors).toHaveLength(6);
    expect(result.metadata.minDeltaE).toBeGreaterThan(0.01);
    // No muddy midpoint — all colors should have some chroma
    const labs = result.colors.map(hexToOklab);
    for (const lab of labs) {
      expect(chroma(lab)).toBeGreaterThan(0.01);
    }
  });

  it('gray-crossing triangle: 3 seeds spanning gray', () => {
    const result = generatePalette(['#ff6b6b', '#4ecdc4', '#2c3e50'], 8);
    expect(result.colors).toHaveLength(8);
    expect(result.metadata.minDeltaE).toBeGreaterThan(0.01);
    // All output valid hex
    for (const c of result.colors) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('one-sided hue cluster: narrow hue range', () => {
    const result = generatePalette(['#ff6b6b', '#ee5a24', '#f0932b', '#ffbe76'], 8);
    expect(result.colors).toHaveLength(8);
    // All colors should be in a warm hue range
    const labs = result.colors.map(hexToOklab);
    for (const lab of labs) {
      const h = hue(lab);
      // Warm hues: roughly -0.5 to 2.0 radians
      expect(h).toBeGreaterThan(-0.8);
      expect(h).toBeLessThan(2.5);
    }
  });

  it('full hue wraparound: evenly spaced hues', () => {
    const result = generatePalette(['#e63946', '#2a9d8f', '#457b9d', '#f4a261'], 10);
    expect(result.colors).toHaveLength(10);
    expect(result.metadata.minDeltaE).toBeGreaterThan(0.01);
  });

  it('muted anchor: 1 warm gray + 4 vivid', () => {
    const result = generatePalette(
      ['#a09080', '#e63946', '#2a9d8f', '#457b9d', '#f4a261'], 10
    );
    expect(result.colors).toHaveLength(10);
    // The warm gray seed should be preserved
    expect(result.colors).toContain('#a09080');
  });

  it('all muted: 4 low-chroma seeds', () => {
    const result = generatePalette(['#8e8e8e', '#9e9080', '#808e90', '#90809e'], 8);
    expect(result.colors).toHaveLength(8);
    // Palette should stay muted — all chromas below 0.15
    const labs = result.colors.map(hexToOklab);
    for (const lab of labs) {
      expect(chroma(lab)).toBeLessThan(0.15);
    }
  });

  it('gamut stress: deep blues + saturated cyans', () => {
    const result = generatePalette(['#0000ff', '#00ffff', '#0044aa', '#00aaff'], 8);
    expect(result.colors).toHaveLength(8);
    // All should be valid hex (in gamut after clipping)
    for (const color of result.colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('near-coplanar: 4 seeds with similar OKLab b values', () => {
    const result = generatePalette(['#ff9966', '#ffcc66', '#cc9966', '#ffaa77'], 8);
    expect(result.colors).toHaveLength(8);
    expect(result.metadata.minDeltaE).toBeGreaterThan(0.005);
  });
});
