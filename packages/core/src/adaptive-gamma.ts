import type { OKLab } from './types';

const TAU_ACHROMATIC = 0.01;

/**
 * Computes the adaptive convexity strength γ from seed hue configuration.
 *
 * Seeds with chroma below τ_achromatic are excluded (their hue angle is
 * numerically meaningless). If fewer than 2 chromatic seeds remain,
 * Δh_max = 0 and γ = 1.
 */
export function computeAdaptiveGamma(
  seeds: readonly OKLab[],
  vividness: number,
): number {
  // Filter chromatic seeds
  const hues: number[] = [];
  for (const s of seeds) {
    const chroma = Math.sqrt(s.a * s.a + s.b * s.b);
    if (chroma > TAU_ACHROMATIC) {
      hues.push(Math.atan2(s.b, s.a));
    }
  }

  if (hues.length < 2) return 1;

  // Max pairwise circular hue distance
  let deltaHMax = 0;
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const diff = Math.abs(hues[i] - hues[j]);
      const circular = Math.min(diff, 2 * Math.PI - diff);
      if (circular > deltaHMax) deltaHMax = circular;
    }
  }

  return 1 + vividness * deltaHMax / Math.PI;
}
