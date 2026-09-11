'use client';
import { RoundedBox } from '@react-three/drei';
export function Box({
  p,
  s,
  color,
  ...props
}: {
  p: [number, number, number];
  s: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={p} castShadow receiveShadow {...props}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  );
}
export function Plant({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.22, 0.6, 12]} />
        <meshStandardMaterial color="#d1c2aa" />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.04, 12]} />
        <meshStandardMaterial color="#564731" />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh
          key={i}
          position={[Math.sin(i * 2.4) * 0.23, 0.85 + (i % 3) * 0.19, Math.cos(i * 2.4) * 0.23]}
          rotation={[Math.sin(i) * 0.6, i, 0.4]}
          scale={[0.22, 0.55, 0.18]}
          castShadow
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={['#4e6842', '#718650', '#3c5d42'][i % 3]} />
        </mesh>
      ))}
    </group>
  );
}
export function Chair({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <RoundedBox
        position={[0, 0.48, 0]}
        args={[0.62, 0.16, 0.64]}
        radius={0.12}
        smoothness={2}
        castShadow
      >
        <meshStandardMaterial color="#426359" roughness={0.9} />
      </RoundedBox>
      <RoundedBox
        position={[0, 0.86, 0.29]}
        args={[0.65, 0.66, 0.12]}
        radius={0.09}
        smoothness={2}
        castShadow
      >
        <meshStandardMaterial color="#4d7061" />
      </RoundedBox>
      <Box p={[0, 0.23, 0]} s={[0.08, 0.45, 0.08]} color="#3d4440" />
      <Box p={[0, 0.08, 0]} s={[0.55, 0.06, 0.08]} color="#3d4440" />
      <Box p={[0, 0.08, 0]} s={[0.08, 0.06, 0.55]} color="#3d4440" />
    </group>
  );
}
