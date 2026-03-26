import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { ReactNode, RefObject, ElementRef } from 'react';

type OrbitControlsImpl = ElementRef<typeof OrbitControls>;

interface SceneSetupProps {
  children: ReactNode;
  controlsRef?: RefObject<OrbitControlsImpl | null>;
}

export function SceneSetup({ children, controlsRef }: SceneSetupProps) {
  return (
    <Canvas camera={{ position: [0.8, 0.8, 0.8], fov: 50, near: 0.01, far: 100 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} />
      <OrbitControls ref={controlsRef} makeDefault />
      {children}
    </Canvas>
  );
}
