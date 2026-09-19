'use client';
import { Html, RoundedBox } from '@react-three/drei';
import { Box, Plant } from './furniture';
import CoffeeStation from './CoffeeStation';
import OfficeLounge from './Lounge';
export default function Architecture() {
  return (
    <group>
      <Box p={[0, -0.27, -5]} s={[11.4, 0.55, 18.4]} color="#c7b59b" />
      <Box p={[0.5, -0.27, 8.5]} s={[27.4, 0.55, 11.4]} color="#c7b59b" />
      <Box p={[0, 0.005, -5]} s={[11, 0.04, 18]} color="#e0c9a7" />
      <Box p={[0.5, 0.005, 8.5]} s={[27, 0.04, 11]} color="#e0c9a7" />
      {Array.from({ length: 56 }, (_, i) => {
        const z = -13.75 + i * 0.5;
        const north = z < 3;
        return (
          <Box
            key={i}
            p={[north ? 0 : 0.5, 0.028, z]}
            s={[north ? 11 : 27, 0.009, 0.012]}
            color="#c8ae87"
          />
        );
      })}
      <Box p={[0, 1.1, -14]} s={[11.3, 2.2, 0.22]} color="#eeeae1" />
      <Box p={[-5.6, 0.85, -5.5]} s={[0.22, 1.7, 17.2]} color="#efebe2" />
      <Box p={[5.6, 0.85, -5.5]} s={[0.22, 1.7, 17.2]} color="#efebe2" />
      <Box p={[-9.2, 1, 3]} s={[7.6, 2, 0.22]} color="#eeeae1" />
      <Box p={[9.8, 1, 3]} s={[8.6, 2, 0.22]} color="#eeeae1" />
      <Box p={[-13, 0.7, 8.5]} s={[0.22, 1.4, 11]} color="#eeeae1" />
      <Box p={[14, 0.7, 8.5]} s={[0.22, 1.4, 11]} color="#eeeae1" />
      <Box p={[0.5, 0.4, 14]} s={[27, 0.8, 0.22]} color="#f1ede3" />
      {[-11, -8, -5, -2, 1].flatMap((z) =>
        [-5.62, 5.62].map((x) => (
          <group key={`${x}-${z}`}>
            <Box p={[x, 1.05, z]} s={[0.24, 0.85, 1.8]} color="#b2c6c8" />
            <Box p={[x, 1.5, z]} s={[0.3, 0.08, 1.95]} color="#fff7e7" />
            <Box p={[x, 1.05, z]} s={[0.27, 0.9, 0.05]} color="#f8f2e5" />
          </group>
        ))
      )}
      {Array.from({ length: 13 }, (_, i) => (
        <group key={i}>
          <Box p={[-11.8 + i * 2, 0.75, 14.02]} s={[1.35, 0.65, 0.1]} color="#a9bfc0" />
          <Box p={[-11.8 + i * 2, 0.42, 14.1]} s={[1.45, 0.08, 0.2]} color="#f4efe3" />
        </group>
      ))}
      <Box p={[-1.6, 0.55, -13.1]} s={[7, 1.1, 1.2]} color="#82917b" />
      <Box p={[-1.6, 1.13, -13.1]} s={[7.15, 0.12, 1.3]} color="#eae4d5" />
      {[-4.3, -3.2, -2.1, -1, 0, 1.1].map((x) => (
        <group key={x}>
          <Box p={[x, 0.55, -12.48]} s={[1, 0.96, 0.02]} color="#75856f" />
          <Box p={[x - 0.28, 0.28, -12.48]} s={[0.05, 0.55, 0.05]} color="#4d5149" />
          <Box p={[x + 0.28, 0.28, -12.48]} s={[0.05, 0.55, 0.05]} color="#4d5149" />
        </group>
      ))}
      <Box p={[-1.7, 1.21, -13.1]} s={[0.95, 0.06, 0.75]} color="#73817b" />
      <Box p={[0.6, 1.21, -13.1]} s={[1, 0.06, 0.72]} color="#3b423d" />
      <Box p={[2.2, 1.05, -13.1]} s={[0.95, 2.1, 1.15]} color="#d2d2c6" />
      <mesh position={[1.35, 1.29, -13.12]} castShadow>
        <sphereGeometry args={[0.25, 16, 8]} />
        <meshStandardMaterial color="#d99a56" roughness={0.8} />
      </mesh>
      <Box p={[1.35, 1.5, -13.12]} s={[0.08, 0.12, 0.08]} color="#6f8550" />
      <Box p={[0.95, 1.29, -13.12]} s={[0.26, 0.03, 0.26]} color="#f1eadb" />
      <Box p={[0.95, 1.39, -13.12]} s={[0.04, 0.18, 0.04]} color="#9ca5a0" />
      <Box p={[0.95, 1.49, -13.2]} s={[0.24, 0.04, 0.04]} color="#9ca5a0" />
      <RoundedBox
        position={[-1, 0.96, -10.6]}
        args={[4.8, 0.18, 1.3]}
        radius={0.15}
        smoothness={2}
        castShadow
      >
        <meshStandardMaterial color="#efe7d7" />
      </RoundedBox>
      <Box p={[-1, 0.47, -10.6]} s={[4.4, 0.94, 1]} color="#bba180" />
      {[-2.5, -1, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.65, -9.5]} castShadow>
          <cylinderGeometry args={[0.27, 0.27, 0.12, 20]} />
          <meshStandardMaterial color="#bc9466" />
        </mesh>
      ))}
      <Box p={[3, 1, -11.6]} s={[0.16, 2, 4.7]} color="#ebe8de" />
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={i}
          p={[4.3, 0.12 + i * 0.12, -10 - i * 0.43]}
          s={[2, 0.24 + i * 0.24, 0.43]}
          color="#cec0a8"
        />
      ))}
      <Html position={[-1, 1.7, -11.1]} center zIndexRange={[10, 0]}>
        <span className="space-label">☕ The kitchen</span>
      </Html>
      <Html position={[4.2, 2, -12]} center zIndexRange={[10, 0]}>
        <span className="small-map-label">STAIRS</span>
      </Html>
      <group position={[12.8, 0, 5]}>
        <Box p={[0, 0.02, 0]} s={[2.1, 0.04, 3.4]} color="#ceccc0" />
        <Box p={[-1.1, 0.8, 0]} s={[0.12, 1.6, 3.4]} color="#ece9dd" />
        <Box p={[0, 0.65, 0]} s={[2.1, 1.3, 0.12]} color="#ece9dd" />
        {[-0.9, 0.9].map((z) => (
          <group key={z}>
            <mesh position={[0.45, 0.35, z]} castShadow>
              <cylinderGeometry args={[0.27, 0.2, 0.5, 18]} />
              <meshStandardMaterial color="#f6f4e9" />
            </mesh>
            <Box p={[0.7, 0.6, z]} s={[0.25, 0.65, 0.5]} color="#efeee6" />
          </group>
        ))}
        <Html position={[0, 1.7, 0]} center zIndexRange={[10, 0]}>
          <span className="small-map-label">WC</span>
        </Html>
      </group>
      <Box p={[7, 0.7, 8]} s={[2, 1.4, 1.4]} color="#b5b9b1" />
      <Box p={[7.5, 0.9, 8]} s={[0.8, 1.8, 1]} color="#d6d7ce" />
      <OfficeLounge />
      <CoffeeStation />
      <Plant x={-4.7} z={2} scale={1.2} />
      <Plant x={4.7} z={2} scale={1.2} />
      <Plant x={-8.7} z={3.7} />
      <Plant x={5.6} z={6} />
      <Plant x={13.1} z={3.7} />
    </group>
  );
}
