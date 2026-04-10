import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useStore } from '../store';
import { useClippingInterlock } from '../hooks/useClippingInterlock';
import type { OptimizationTrace } from 'facette';

const makeTrace = (frameCount: number): OptimizationTrace => ({
  geometry: { kind: 'line', start: { L: 0, a: 0, b: 0 }, end: { L: 1, a: 0, b: 0 } },
  seeds: [],
  frames: Array.from({ length: frameCount }, (_, i) => ({
    iteration: i,
    particles: [{ kind: 'free-1d' as const, position: { L: 0.5, a: 0, b: 0 }, t: 0.5 }],
    oklabPositions: [{ L: 0.5, a: 0, b: 0 }],
    energy: 0,
    minDeltaE: 0,
    p: 2,
    stepSize: 0.01,
  })),
  finalColors: ['#777777'],
  clippedIndices: [],
  clippedPositions: [{ L: 0.5, a: 0, b: 0 }],
  liftConfig: { rs: 0.04, R: 0.15, gamma: 1 },
  vividness: 2,
  spread: 1.5,
  Lc: 0.5,
});

beforeEach(() => {
  useStore.setState({
    trace: makeTrace(5),
    currentFrame: 0,
    showClipping: false,
    morphT: 0,
  });
});

describe('useClippingInterlock', () => {
  it('jumps to last frame when showClipping is turned on', () => {
    renderHook(() => useClippingInterlock());
    act(() => useStore.getState().toggleClipping());
    expect(useStore.getState().currentFrame).toBe(4);
  });

  it('sets morphT to 0 when showClipping is turned on while lifted', () => {
    useStore.setState({ morphT: 1 });
    renderHook(() => useClippingInterlock());
    act(() => useStore.getState().toggleClipping());
    expect(useStore.getState().morphT).toBe(0);
  });

  it('disables showClipping when currentFrame changes away from last', () => {
    useStore.setState({ currentFrame: 4, showClipping: true });
    renderHook(() => useClippingInterlock());
    act(() => useStore.getState().setCurrentFrame(2));
    expect(useStore.getState().showClipping).toBe(false);
  });

  it('disables showClipping when morphT leaves 0', () => {
    useStore.setState({ currentFrame: 4, showClipping: true });
    renderHook(() => useClippingInterlock());
    act(() => useStore.getState().setMorphT(0.5));
    expect(useStore.getState().showClipping).toBe(false);
  });

  it('does not disable showClipping when on last frame', () => {
    useStore.setState({ currentFrame: 4, showClipping: true });
    renderHook(() => useClippingInterlock());
    // Re-setting to last frame should not disable
    act(() => useStore.getState().setCurrentFrame(4));
    expect(useStore.getState().showClipping).toBe(true);
  });

  it('jumps to last frame of new trace when trace changes while clipping is active', () => {
    useStore.setState({ currentFrame: 4, showClipping: true });
    renderHook(() => useClippingInterlock());
    // Simulate regeneration: new trace + currentFrame reset to 0
    const newTrace = makeTrace(8);
    act(() => {
      useStore.setState({ trace: newTrace, currentFrame: 0 });
    });
    // Should jump to last frame of new trace, not disable clipping
    expect(useStore.getState().showClipping).toBe(true);
    expect(useStore.getState().currentFrame).toBe(7);
  });
});
