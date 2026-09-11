'use client';

import { Html, RoundedBox } from '@react-three/drei';
import { Box } from './furniture';

export const COFFEE_STATION_POSITION: [number, number] = [-4.7, -12];

export default function CoffeeStation() {
  return (
    <group position={[COFFEE_STATION_POSITION[0], 0, COFFEE_STATION_POSITION[1]]}>
      <RoundedBox
        position={[0, 0.52, 0]}
        args={[1.8, 1.04, 0.82]}
        radius={0.08}
        smoothness={2}
        castShadow
      >
        <meshStandardMaterial color="#8a6548" roughness={0.86} />
      </RoundedBox>
      <Box p={[0, 1.08, 0]} s={[1.92, 0.1, 0.9]} color="#3f3027" />
      {[-0.58, 0, 0.58].map((x) => (
        <Box key={x} p={[x, 0.47, 0.42]} s={[0.06, 0.72, 0.04]} color="#5f4330" />
      ))}
      <RoundedBox
        position={[0.2, 2.18, -0.3]}
        args={[1.55, 0.08, 0.24]}
        radius={0.04}
        smoothness={2}
        castShadow
      >
        <meshStandardMaterial color="#8a6548" />
      </RoundedBox>
      <Box p={[0.42, 1.84, 0]} s={[0.08, 0.62, 0.08]} color="#5f4330" />
      <Box p={[-0.42, 1.84, 0]} s={[0.08, 0.62, 0.08]} color="#5f4330" />
      <Box p={[0, 2.12, 0]} s={[1, 0.08, 0.08]} color="#5f4330" />
      <RoundedBox
        position={[-0.3, 1.4, -0.04]}
        args={[0.62, 0.48, 0.42]}
        radius={0.08}
        smoothness={2}
        castShadow
      >
        <meshStandardMaterial color="#252827" roughness={0.4} metalness={0.35} />
      </RoundedBox>
      <mesh position={[-0.3, 1.7, -0.04]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.16, 16]} />
        <meshStandardMaterial color="#171a19" roughness={0.45} />
      </mesh>
      <mesh position={[-0.3, 1.16, 0.18]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.025, 20]} />
        <meshStandardMaterial color="#1e2422" roughness={0.35} />
      </mesh>
      <mesh position={[0.38, 1.38, 0.02]} castShadow>
        <cylinderGeometry args={[0.16, 0.14, 0.28, 16]} />
        <meshStandardMaterial color="#c6a36f" roughness={0.8} />
      </mesh>
      {[-0.72, 0.72].map((x) => (
        <group key={x} position={[x, 1.39, 0.12]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.12, 0.1, 0.2, 16]} />
            <meshStandardMaterial color="#f1eadc" />
          </mesh>
          <mesh position={[0.13, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.07, 0.018, 8, 16]} />
            <meshStandardMaterial color="#f1eadc" />
          </mesh>
        </group>
      ))}
      <Box p={[0.18, 0.1, 0.28]} s={[0.72, 0.03, 0.32]} color="#252827" />
      <Html position={[0, 2.45, 0]} center zIndexRange={[10, 0]}>
        <span className="space-label">☕ Coffee station</span>
      </Html>
    </group>
  );
}
