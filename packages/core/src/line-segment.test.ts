import { describe, it, expect } from 'vitest';
import { createLineConstraint } from './line-segment';
import type { Particle, OKLab } from './types';

describe('LineConstraint', () => {
  const start: OKLab = { L: 0.2, a: -0.1, b: 0 };
  const end: OKLab = { L: 0.8, a: 0.1, b: 0 };
  const constraint = createLineConstraint(start, end);

  describe('projectToTangent', () => {
    it('projects perpendicular force to zero', () => {
      const particle: Particle = { kind: 'free-1d', position: { L: 0.5, a: 0, b: 0 }, t: 0.5 };
      const perpForce: [number, number, number] = [0, 0, 1];
      const projected = constraint.projectToTangent(perpForce, particle);
      expect(Math.abs(projected[0])).toBeCloseTo(0, 6);
      expect(Math.abs(projected[1])).toBeCloseTo(0, 6);
      expect(Math.abs(projected[2])).toBeCloseTo(0, 6);
    });

    it('preserves force along segment direction', () => {
      const particle: Particle = { kind: 'free-1d', position: { L: 0.5, a: 0, b: 0 }, t: 0.5 };
      // Direction of segment is (0.6, 0.2, 0), normalized
      const alongForce: [number, number, number] = [0.6, 0.2, 0];
      const projected = constraint.projectToTangent(alongForce, particle);
      const mag = Math.sqrt(projected[0]**2 + projected[1]**2 + projected[2]**2);
      expect(mag).toBeGreaterThan(0.1);
    });

    it('returns zero for pinned particles', () => {
      const particle: Particle = { kind: 'pinned-endpoint', position: start, t: 0 };
      const force: [number, number, number] = [1, 1, 1];
      const projected = constraint.projectToTangent(force, particle);
      expect(projected[0]).toBe(0);
      expect(projected[1]).toBe(0);
      expect(projected[2]).toBe(0);
    });
  });

  describe('applyDisplacement', () => {
    it('moves free-1d particle along segment', () => {
      const particle: Particle = { kind: 'free-1d', position: { L: 0.5, a: 0, b: 0 }, t: 0.5 };
      // Small displacement along segment direction
      const disp: [number, number, number] = [0.06, 0.02, 0]; // ~0.1 in segment direction
      const result = constraint.applyDisplacement(particle, disp);
      expect(result.kind).toBe('free-1d');
      if (result.kind === 'free-1d') {
        expect(result.t).toBeGreaterThan(0.5);
        expect(result.t).toBeLessThanOrEqual(1);
      }
    });

    it('clamps t to [0, 1]', () => {
      const particle: Particle = { kind: 'free-1d', position: end, t: 0.95 };
      const bigDisp: [number, number, number] = [0.6, 0.2, 0]; // large positive
      const result = constraint.applyDisplacement(particle, bigDisp);
      if (result.kind === 'free-1d') {
        expect(result.t).toBeLessThanOrEqual(1);
        expect(result.t).toBeGreaterThanOrEqual(0);
      }
    });

    it('clamps t at lower bound', () => {
      const particle: Particle = { kind: 'free-1d', position: start, t: 0.05 };
      const negDisp: [number, number, number] = [-0.6, -0.2, 0];
      const result = constraint.applyDisplacement(particle, negDisp);
      if (result.kind === 'free-1d') {
        expect(result.t).toBeGreaterThanOrEqual(0);
      }
    });

    it('does not move pinned-endpoint particles', () => {
      const particle: Particle = { kind: 'pinned-endpoint', position: start, t: 0 };
      const result = constraint.applyDisplacement(particle, [1, 1, 1]);
      expect(result.kind).toBe('pinned-endpoint');
      if (result.kind === 'pinned-endpoint') {
        expect(result.t).toBe(0);
        expect(result.position).toEqual(start);
      }
    });

    it('position matches t after displacement', () => {
      const particle: Particle = { kind: 'free-1d', position: { L: 0.5, a: 0, b: 0 }, t: 0.5 };
      const disp: [number, number, number] = [0.06, 0.02, 0];
      const result = constraint.applyDisplacement(particle, disp);
      if (result.kind === 'free-1d') {
        const expectedL = start.L + result.t * (end.L - start.L);
        const expectedA = start.a + result.t * (end.a - start.a);
        expect(result.position.L).toBeCloseTo(expectedL, 8);
        expect(result.position.a).toBeCloseTo(expectedA, 8);
      }
    });
  });
});
