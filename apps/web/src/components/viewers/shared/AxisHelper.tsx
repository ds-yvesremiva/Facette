import { Line, Text } from '@react-three/drei';

interface AxisHelperProps {
  labels?: [string, string, string];
  size?: number;
}

export function AxisHelper({ labels = ['a', 'L', 'b'], size = 0.5 }: AxisHelperProps) {
  return (
    <group>
      <Line points={[[0,0,0], [size,0,0]]} color="#ef4444" lineWidth={1.5} />
      <Text position={[size + 0.03, 0, 0]} fontSize={0.03} color="#ef4444">{labels[0]}</Text>

      <Line points={[[0,0,0], [0,size,0]]} color="#22c55e" lineWidth={1.5} />
      <Text position={[0, size + 0.03, 0]} fontSize={0.03} color="#22c55e">{labels[1]}</Text>

      <Line points={[[0,0,0], [0,0,size]]} color="#3b82f6" lineWidth={1.5} />
      <Text position={[0, 0, size + 0.03]} fontSize={0.03} color="#3b82f6">{labels[2]}</Text>
    </group>
  );
}
