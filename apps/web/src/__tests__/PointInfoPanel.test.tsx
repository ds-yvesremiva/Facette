import { beforeEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
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
  liftConfig: { rs: 0.04, R: 0.15, gamma: 1 },
  vividness: 2,
  spread: 1.5,
  Lc: 0.5,
};

beforeEach(() => {
  useStore.setState({
    trace,
    currentFrame: 0,
    selectedIndex: null,
    hoveredIndex: null,
  });
});

describe('PointInfoPanel', () => {
  it('renders the fallback message when the selected index is stale', () => {
    useStore.setState({ selectedIndex: 5 });
    const html = renderToString(<PointInfoPanel />);
    expect(html).toContain('Click a point to inspect it');
  });
});
