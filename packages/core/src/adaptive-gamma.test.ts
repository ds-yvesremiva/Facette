import { describe, it, expect } from 'vitest';
import { computeAdaptiveGamma } from './adaptive-gamma';
import type { OKLab } from './types';

describe('computeAdaptiveGamma', () => {
  // Helper: create OKLab from L, chroma, hue (radians)
  function oklabFromLCh(L: number, C: number, h: number): OKLab {
    return { L, a: C * Math.cos(h), b: C * Math.sin(h) };
  }

  describe('edge cases', () => {
    it('returns 1 when fewer than 2 chromatic seeds', () => {
      const seeds = [{ L: 0.5, a: 0, b: 0 }];
      expect(computeAdaptiveGamma(seeds, 2)).toBe(1);
    });

    it('returns 1 when all seeds achromatic (chroma < 0.01)', () => {
      const seeds = [
        { L: 0.3, a: 0.005, b: 0 },
        { L: 0.7, a: 0, b: 0.003 },
      ];
      expect(computeAdaptiveGamma(seeds, 2)).toBe(1);
    });

    it('returns 1 when single chromatic seed among achromatics', () => {
      const seeds = [
        oklabFromLCh(0.5, 0.15, 0),
        { L: 0.3, a: 0, b: 0 },
        { L: 0.7, a: 0.005, b: 0 },
      ];
      expect(computeAdaptiveGamma(seeds, 2)).toBe(1);
    });

    it('excludes achromatic seeds from hue spread', () => {
      const seeds = [
        { L: 0.5, a: 0, b: 0 },
        oklabFromLCh(0.5, 0.15, 0),
        oklabFromLCh(0.5, 0.15, Math.PI / 2),
      ];
      const gamma = computeAdaptiveGamma(seeds, 2);
      expect(gamma).toBeCloseTo(2, 6);
    });
  });

  describe('formula correctness', () => {
    it('returns 1 when all chromatic seeds have same hue', () => {
      const seeds = [
        oklabFromLCh(0.4, 0.10, 0.5),
        oklabFromLCh(0.6, 0.15, 0.5),
        oklabFromLCh(0.8, 0.12, 0.5),
      ];
      expect(computeAdaptiveGamma(seeds, 2)).toBeCloseTo(1, 6);
    });

    it('returns 1 + v for complementary seeds (Δh_max = π)', () => {
      const seeds = [
        oklabFromLCh(0.5, 0.15, 0),
        oklabFromLCh(0.5, 0.15, Math.PI),
      ];
      expect(computeAdaptiveGamma(seeds, 2)).toBeCloseTo(3, 6);
    });

    it('returns 1 + v/2 for 90-degree separation', () => {
      const seeds = [
        oklabFromLCh(0.5, 0.15, 0),
        oklabFromLCh(0.5, 0.15, Math.PI / 2),
      ];
      expect(computeAdaptiveGamma(seeds, 2)).toBeCloseTo(2, 6);
    });

    it('uses circular distance (wraps around 2π)', () => {
      const h1 = -10 * Math.PI / 180;
      const h2 = 10 * Math.PI / 180;
      const seeds = [
        oklabFromLCh(0.5, 0.15, h1),
        oklabFromLCh(0.5, 0.15, h2),
      ];
      const gamma = computeAdaptiveGamma(seeds, 2);
      const expected = 1 + 2 * (20 * Math.PI / 180) / Math.PI;
      expect(gamma).toBeCloseTo(expected, 6);
    });
  });

  describe('vividness parameter', () => {
    it('returns 1 always when vividness = 0', () => {
      const seeds = [
        oklabFromLCh(0.5, 0.15, 0),
        oklabFromLCh(0.5, 0.15, Math.PI),
      ];
      expect(computeAdaptiveGamma(seeds, 0)).toBe(1);
    });

    it('scales linearly with vividness', () => {
      const seeds = [
        oklabFromLCh(0.5, 0.15, 0),
        oklabFromLCh(0.5, 0.15, Math.PI),
      ];
      const g1 = computeAdaptiveGamma(seeds, 1);
      const g2 = computeAdaptiveGamma(seeds, 2);
      const g4 = computeAdaptiveGamma(seeds, 4);
      expect(g1).toBeCloseTo(2, 6);
      expect(g2).toBeCloseTo(3, 6);
      expect(g4).toBeCloseTo(5, 6);
    });
  });
});
