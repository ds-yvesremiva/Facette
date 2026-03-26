import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../../store';

export function useMorphToggle() {
  const morphT = useStore((s) => s.morphT);
  const setMorphT = useStore((s) => s.setMorphT);
  const targetRef = useRef(0);
  const animRef = useRef<number | null>(null);

  const toggle = useCallback(() => {
    targetRef.current = useStore.getState().morphT < 0.5 ? 1 : 0;

    const animate = () => {
      const current = useStore.getState().morphT;
      const target = targetRef.current;
      const diff = target - current;
      if (Math.abs(diff) < 0.005) {
        setMorphT(target);
        return;
      }
      setMorphT(current + diff * 0.12);
      animRef.current = requestAnimationFrame(animate);
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
  }, [setMorphT]);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return { morphT, toggle, isWarped: morphT > 0.5 };
}
