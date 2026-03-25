import { describe, it, expect } from 'vitest';
import {
  vec3Add, vec3Sub, vec3Scale, vec3Dot, vec3Cross,
  vec3Norm, vec3Normalize, vec3Lerp,
  mat3MulVec3, mat3Transpose, mat3Mul,
} from './math';

describe('vec3 operations', () => {
  it('adds two vectors', () => {
    expect(vec3Add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });

  it('subtracts two vectors', () => {
    expect(vec3Sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
  });

  it('scales a vector', () => {
    expect(vec3Scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });

  it('computes dot product', () => {
    expect(vec3Dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(vec3Dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('computes cross product', () => {
    expect(vec3Cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(vec3Cross([0, 1, 0], [1, 0, 0])).toEqual([0, 0, -1]);
  });

  it('computes norm', () => {
    expect(vec3Norm([3, 4, 0])).toBe(5);
    expect(vec3Norm([0, 0, 0])).toBe(0);
  });

  it('normalizes a vector', () => {
    const n = vec3Normalize([3, 4, 0]);
    expect(n[0]).toBeCloseTo(0.6);
    expect(n[1]).toBeCloseTo(0.8);
    expect(n[2]).toBeCloseTo(0);
  });

  it('returns zero vector when normalizing zero vector', () => {
    expect(vec3Normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('linearly interpolates', () => {
    const r = vec3Lerp([0, 0, 0], [10, 20, 30], 0.5);
    expect(r).toEqual([5, 10, 15]);
  });

  it('lerp at t=0 returns a', () => {
    expect(vec3Lerp([1, 2, 3], [4, 5, 6], 0)).toEqual([1, 2, 3]);
  });

  it('lerp at t=1 returns b', () => {
    expect(vec3Lerp([1, 2, 3], [4, 5, 6], 1)).toEqual([4, 5, 6]);
  });
});

describe('mat3 operations', () => {
  it('multiplies matrix by vector (identity)', () => {
    const I: [[number,number,number],[number,number,number],[number,number,number]] = [[1,0,0],[0,1,0],[0,0,1]];
    expect(mat3MulVec3(I, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('multiplies matrix by vector (non-trivial)', () => {
    const M: [[number,number,number],[number,number,number],[number,number,number]] = [[1,2,3],[4,5,6],[7,8,9]];
    // [1*1+2*2+3*3, 4*1+5*2+6*3, 7*1+8*2+9*3] = [14, 32, 50]
    expect(mat3MulVec3(M, [1, 2, 3])).toEqual([14, 32, 50]);
  });

  it('transposes a matrix', () => {
    const M: [[number,number,number],[number,number,number],[number,number,number]] = [[1,2,3],[4,5,6],[7,8,9]];
    expect(mat3Transpose(M)).toEqual([[1,4,7],[2,5,8],[3,6,9]]);
  });

  it('multiplies two matrices', () => {
    const I: [[number,number,number],[number,number,number],[number,number,number]] = [[1,0,0],[0,1,0],[0,0,1]];
    const M: [[number,number,number],[number,number,number],[number,number,number]] = [[1,2,3],[4,5,6],[7,8,9]];
    expect(mat3Mul(I, M)).toEqual(M);
    expect(mat3Mul(M, I)).toEqual(M);
  });
});
