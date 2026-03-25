import type { Vec3 } from './types';

export type Mat3 = [Vec3, Vec3, Vec3];

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Norm(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const n = vec3Norm(v);
  return n === 0 ? [0, 0, 0] : vec3Scale(v, 1 / n);
}

export function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function mat3MulVec3(m: Mat3, v: Vec3): Vec3 {
  return [vec3Dot(m[0], v), vec3Dot(m[1], v), vec3Dot(m[2], v)];
}

export function mat3Transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

export function mat3Mul(a: Mat3, b: Mat3): Mat3 {
  const bt = mat3Transpose(b);
  return [
    [vec3Dot(a[0], bt[0]), vec3Dot(a[0], bt[1]), vec3Dot(a[0], bt[2])],
    [vec3Dot(a[1], bt[0]), vec3Dot(a[1], bt[1]), vec3Dot(a[1], bt[2])],
    [vec3Dot(a[2], bt[0]), vec3Dot(a[2], bt[1]), vec3Dot(a[2], bt[2])],
  ];
}
