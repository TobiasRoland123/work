'use client';
import { Html, RoundedBox } from '@react-three/drei';
import { Box, Plant } from './furniture';

function Upholstery({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <RoundedBox
      position={position}
      args={size}
      radius={0.1}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.95} />
    </RoundedBox>
  );
}
function Sofa() {
  return (
    <group position={[0.4, 0, 0.45]}>
      {[-1.1, 1.1].flatMap((x) =>
        [-0.3, 0.3].map((z) => (
          <Box key={`${x}-${z}`} p={[x, 0.18, z]} s={[0.09, 0.3, 0.09]} color="#705b42" />
        ))
      )}
      <Upholstery position={[0, 0.4, 0]} size={[2.9, 0.4, 0.95]} color="#647961" />
      <Upholstery position={[0, 0.85, 0.4]} size={[2.9, 0.8, 0.22]} color="#72866d" />
      {[-1.36, 1.36].map((x) => (
        <Upholstery key={x} position={[x, 0.68, 0]} size={[0.2, 0.6, 0.92]} color="#71866c" />
      ))}
      {[-0.88, 0, 0.88].map((x) => (
        <Upholstery key={x} position={[x, 0.66, -0.08]} size={[0.83, 0.18, 0.66]} color="#91a087" />
      ))}
      <group rotation={[0, 0, 0.12]}>
        <Upholstery position={[-0.91, 0.94, 0.16]} size={[0.43, 0.43, 0.15]} color="#d4b586" />
      </group>
      <group rotation={[0, 0, -0.1]}>
        <Upholstery position={[0.94, 0.94, 0.16]} size={[0.43, 0.43, 0.15]} color="#b87857" />
      </group>
    </group>
  );
}
export default function OfficeLounge() {
  return (
    <group position={[4.2, 0, 5.1]} name="office-lounge">
      <RoundedBox
        position={[0, 0.045, 0]}
        args={[4.4, 0.04, 3.2]}
        radius={0.12}
        smoothness={2}
        receiveShadow
      >
        <meshStandardMaterial color="#d7c6a9" roughness={1} />
      </RoundedBox>
      {[-1.7, -1.5, 1.5, 1.7].map((x) => (
        <Box key={x} p={[x, 0.069, 0]} s={[0.025, 0.007, 3]} color="#bdad92" />
      ))}
      <Sofa />
      <group position={[-1.15, 0, -0.65]} rotation={[0, Math.PI / 2, 0]}>
        <Upholstery position={[0, 0.47, 0]} size={[0.95, 0.5, 0.85]} color="#b17955" />
        <Upholstery position={[0, 0.88, 0.34]} size={[0.95, 0.65, 0.2]} color="#b78662" />
        {[-0.4, 0.4].map((x) => (
          <Upholstery key={x} position={[x, 0.69, 0]} size={[0.17, 0.42, 0.8]} color="#bb8a64" />
        ))}
        <Upholstery position={[0, 0.77, -0.08]} size={[0.64, 0.14, 0.56]} color="#c79772" />
      </group>
      <group position={[0.35, 0, -0.62]}>
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.61, 0.61, 0.12, 32]} />
          <meshStandardMaterial color="#b99469" roughness={0.75} />
        </mesh>
        {[-0.33, 0.33].map((x) => (
          <Box key={x} p={[x, 0.22, 0]} s={[0.09, 0.44, 0.09]} color="#736047" />
        ))}
        <Box p={[-0.16, 0.52, 0]} s={[0.34, 0.035, 0.25]} color="#7b947f" />
        <Box p={[-0.13, 0.55, 0.015]} s={[0.3, 0.025, 0.22]} color="#f2e9d5" />
        <mesh position={[0.22, 0.58, 0.06]}>
          <cylinderGeometry args={[0.07, 0.065, 0.13, 12]} />
          <meshStandardMaterial color="#f4ecdc" />
        </mesh>
      </group>
      <Plant x={1.7} z={-0.7} scale={0.7} />
      <Html position={[0.3, 1.45, -1.25]} center zIndexRange={[10, 0]}>
        <span className="space-label">The lounge</span>
      </Html>
    </group>
  );
}
