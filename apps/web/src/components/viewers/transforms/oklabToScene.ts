import type { OKLab } from 'facette';

/** Maps OKLab coordinates to Three.js scene coordinates: a→x, L→y, b→z */
export function oklabToScene(lab: OKLab): [number, number, number] {
  return [lab.a, lab.L, lab.b];
}
