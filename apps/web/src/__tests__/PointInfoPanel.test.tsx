import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';
import type { OptimizationTrace } from 'facette';
import { PointInfoPanel } from '../components/info/PointInfoPanel';
import { useStore } from '../store';

const trace: OptimizationTrace = {
  geometry: {
    kind: 'line',
    start: { L: 0.2, a: 0, b: 0 },
    end: { L: 0.8, a: 0, b: 0 },
  },
  seeds: [],
  frames: [
    {
      iteration: 0,
      particles: [{ kind: 'free-1d', position: { L: 0.5, a: 0, b: 0 }, t: 0.5 }],
      oklabPositions: [{ L: 0.5, a: 0, b: 0 }],
      energy: 0,
      minDeltaE: 0,
      p: 2,
      stepSize: 0.01,
    },
  ],
  finalColors: ['#777777'],
  clippedIndices: [],
  clippedPositions: [{ L: 0.5, a: 0, b: 0 }],
  liftConfig: { rs: 0.04, R: 0.15, gamma: 1 },
  vividness: 2,
  spread: 1.5,
  Lc: 0.5,
};

beforeEach(() => {
  act(() => {
    useStore.setState({
      trace,
      currentFrame: 0,
      selectedIndex: null,
      hoveredIndex: null,
    });
  });
});

describe('PointInfoPanel', () => {
  it('renders the fallback message when the selected index is stale', () => {
    act(() => { useStore.setState({ selectedIndex: 5 }); });
    const { container } = render(<PointInfoPanel />);
    expect(container.innerHTML).toContain('Click a point to inspect it');
  });

  it('shows "In gamut" for a non-clipped point on last frame', () => {
    act(() => { useStore.setState({ selectedIndex: 0, currentFrame: 0 }); });
    const { container } = render(<PointInfoPanel />);
    expect(container.innerHTML).toContain('In gamut');
  });

  it('shows clipped values for a clipped point on last frame', () => {
    const clippedTrace: OptimizationTrace = {
      ...trace,
      clippedIndices: [0],
      clippedPositions: [{ L: 0.5, a: 0.1, b: 0.1 }],
    };
    act(() => { useStore.setState({ trace: clippedTrace, selectedIndex: 0, currentFrame: 0 }); });
    const { container } = render(<PointInfoPanel />);
    expect(container.innerHTML).toContain('Clipped');
  });
});
