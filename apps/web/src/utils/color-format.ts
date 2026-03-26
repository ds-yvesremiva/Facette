import type { OKLab, OKLCh } from 'facette';

export function formatOKLab(lab: OKLab): string {
  return `L: ${lab.L.toFixed(3)}, a: ${lab.a.toFixed(3)}, b: ${lab.b.toFixed(3)}`;
}

export function formatOKLCh(lch: OKLCh): string {
  const hDeg = ((lch.h * 180) / Math.PI).toFixed(1);
  return `L: ${lch.L.toFixed(3)}, C: ${lch.C.toFixed(3)}, h: ${hDeg}°`;
}

export function formatRGB(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
