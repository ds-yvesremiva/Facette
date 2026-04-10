import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function useClippingInterlock(): void {
  const showClipping = useStore((s) => s.showClipping);
  const currentFrame = useStore((s) => s.currentFrame);
  const morphT = useStore((s) => s.morphT);
  const trace = useStore((s) => s.trace);
  const prevShowClipping = useRef(showClipping);

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

  // When frame moves away from last: disable clipping
  useEffect(() => {
    if (showClipping && currentFrame !== lastFrame) {
      useStore.setState({ showClipping: false });
    }
  }, [currentFrame, showClipping, lastFrame]);

  // When morphT leaves 0: disable clipping
  useEffect(() => {
    if (showClipping && morphT > 0) {
      useStore.setState({ showClipping: false });
    }
  }, [morphT, showClipping]);
}
