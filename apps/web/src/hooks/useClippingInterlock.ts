import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function useClippingInterlock(): void {
  const showClipping = useStore((s) => s.showClipping);
  const currentFrame = useStore((s) => s.currentFrame);
  const morphT = useStore((s) => s.morphT);
  const trace = useStore((s) => s.trace);
  const prevShowClipping = useRef(showClipping);
  const prevTrace = useRef(trace);

  const lastFrame = trace ? trace.frames.length - 1 : 0;

  // When showClipping turns on: jump to last frame, force unlifted
  useEffect(() => {
    if (showClipping && !prevShowClipping.current) {
      useStore.getState().setCurrentFrame(lastFrame);
      if (useStore.getState().morphT > 0) {
        useStore.getState().setMorphT(0);
      }
    }
    prevShowClipping.current = showClipping;
  }, [showClipping, lastFrame]);

  // When trace changes or frame moves away from last: handle clipping state
  useEffect(() => {
    if (!showClipping) {
      prevTrace.current = trace;
      return;
    }

    // New trace arrived (regeneration) — jump to its last frame
    if (trace !== prevTrace.current && trace) {
      prevTrace.current = trace;
      useStore.getState().setCurrentFrame(trace.frames.length - 1);
      return;
    }
    prevTrace.current = trace;

    // User scrubbed to a different frame — disable clipping
    if (currentFrame !== lastFrame) {
      useStore.setState({ showClipping: false });
    }
  }, [currentFrame, showClipping, lastFrame, trace]);

  // When morphT leaves 0: disable clipping
  useEffect(() => {
    if (showClipping && morphT > 0) {
      useStore.setState({ showClipping: false });
    }
  }, [morphT, showClipping]);
}
