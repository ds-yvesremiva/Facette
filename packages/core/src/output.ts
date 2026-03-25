import type { Particle, GamutChecker } from './types';
import { oklabToHex } from './color-conversion';

export { oklabToHex } from './color-conversion';

/**
 * Convert an array of particles to sRGB hex strings, clipping any out-of-gamut
 * positions to the sRGB boundary while preserving hue and lightness.
 *
 * @returns colors - one #rrggbb string per particle, in the same order
 * @returns clippedIndices - indices of particles that required gamut clipping
 */
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
