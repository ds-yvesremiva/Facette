import { describe, it, expect } from 'vitest';
import { oklabToScene } from '../components/viewers/transforms/oklabToScene';
import { oklchToScene } from '../components/viewers/transforms/oklchToScene';

describe('oklabToScene', () => {
  it('maps OKLab to Three.js coords (a=x, L=y, b=z)', () => {
    const [x, y, z] = oklabToScene({ L: 0.5, a: 0.1, b: -0.2 });
    expect(x).toBeCloseTo(0.1);
    expect(y).toBeCloseTo(0.5);
    expect(z).toBeCloseTo(-0.2);
  });

  it('maps origin correctly', () => {
    const [x, y, z] = oklabToScene({ L: 0, a: 0, b: 0 });
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(z).toBe(0);
  });
});

describe('oklchToScene', () => {
  it('maps OKLCh to cylindrical coords (C*cos(h)=x, L=y, C*sin(h)=z)', () => {
    const [x, y, z] = oklchToScene({ L: 0.5, C: 0.1, h: 0 });
    expect(x).toBeCloseTo(0.1);
    expect(y).toBeCloseTo(0.5);
    expect(z).toBeCloseTo(0);
  });

  it('handles h = π/2', () => {
    const [x, y, z] = oklchToScene({ L: 0.5, C: 0.1, h: Math.PI / 2 });
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0.5);
    expect(z).toBeCloseTo(0.1);
  });

  it('handles h = π', () => {
    const [x, y, z] = oklchToScene({ L: 0.5, C: 0.1, h: Math.PI });
    expect(x).toBeCloseTo(-0.1);
    expect(y).toBeCloseTo(0.5);
    expect(z).toBeCloseTo(0);
  });

  it('zero chroma maps to L axis', () => {
    const [x, y, z] = oklchToScene({ L: 0.7, C: 0, h: 1.5 });
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0.7);
    expect(z).toBeCloseTo(0);
  });
});
