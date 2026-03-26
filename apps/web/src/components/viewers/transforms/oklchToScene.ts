import type { OKLCh } from 'facette';

/** Maps OKLCh to cylindrical scene coordinates: C*cos(h)→x, L→y, C*sin(h)→z */
export function oklchToScene(lch: OKLCh): [number, number, number] {
  return [lch.C * Math.cos(lch.h), lch.L, lch.C * Math.sin(lch.h)];
}
