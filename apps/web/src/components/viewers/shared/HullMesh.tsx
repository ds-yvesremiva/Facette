import { Line } from '@react-three/drei';
import type { OKLab } from 'facette';

interface HullMeshProps {
  vertices: OKLab[];
  faceIndices: Array<{ vertexIndices: [number, number, number] }>;
  positionMapper: (pos: OKLab) => [number, number, number];
}

export function HullMesh({ vertices, faceIndices, positionMapper }: HullMeshProps) {
  const edges = new Set<string>();
  const edgeLines: Array<[[number,number,number], [number,number,number]]> = [];

  for (const face of faceIndices) {
    const [a, b, c] = face.vertexIndices;
    for (const [i, j] of [[a,b], [b,c], [c,a]] as [number,number][]) {
      const key = `${Math.min(i,j)}-${Math.max(i,j)}`;
      if (!edges.has(key)) {
        edges.add(key);
        edgeLines.push([positionMapper(vertices[i]), positionMapper(vertices[j])]);
      }
    }
  }

  return (
    <group>
      {edgeLines.map((pts, idx) => (
        <Line key={idx} points={pts} color="#9ca3af" lineWidth={1} transparent opacity={0.5} />
      ))}
    </group>
  );
}
