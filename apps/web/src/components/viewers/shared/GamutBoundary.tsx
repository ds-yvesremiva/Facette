import { useMemo } from 'react';
import * as THREE from 'three';
import gamutData from '../../../assets/srgb-gamut.json';

export function GamutBoundary() {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(gamutData.vertices);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(gamutData.indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#555555"
        wireframe
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
