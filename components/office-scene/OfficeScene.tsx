'use client';
import { Component, useEffect, useRef, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import Architecture from './Architecture';
import { Box, Chair, Plant } from './furniture';
import OfficeLife, { type OfficePerson } from './OfficeLife';
import { desks, rooms, type Desk, type OfficeRoom } from '@/lib/office-model/geometry';

export type SceneProps = {
  people: OfficePerson[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  topDown: boolean;
  zoom: number;
  reset: number;
  animate: boolean;
};

function Workstation({ desk }: { desk: Desk }) {
  return (
    <group position={[desk.position[0], 0, desk.position[1]]}>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.48, 2.02]} />
        <meshStandardMaterial color="#5a9371" transparent opacity={0.2} />
      </mesh>
      <group rotation={[0, desk.rotation, 0]}>
        <RoundedBox
          args={[1.35, 0.12, 1.45]}
          position={[0, 0.95, 0]}
          radius={0.035}
          smoothness={2}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#d6b381" roughness={0.72} />
        </RoundedBox>
        {[-0.52, 0.52].flatMap((x) =>
          [-0.63, 0.63].map((z) => (
            <Box key={`${x}-${z}`} p={[x, 0.46, z]} s={[0.055, 0.92, 0.055]} color="#a59b87" />
          ))
        )}
        <Box p={[0.41, 1.27, 0]} s={[0.065, 0.52, 0.75]} color="#343b37" />
        <Box p={[0.445, 1.27, 0]} s={[0.01, 0.43, 0.64]} color="#728580" />
        <Box p={[0.41, 1.05, 0]} s={[0.24, 0.045, 0.3]} color="#6b7069" />
        <Box p={[-0.07, 1.027, 0]} s={[0.3, 0.025, 0.65]} color="#e2ded3" />
        <mesh position={[-0.3, 1.1, 0.5]} castShadow>
          <cylinderGeometry args={[0.07, 0.06, 0.17, 12]} />
          <meshStandardMaterial color="#f5eee0" />
        </mesh>
        <group rotation={[0, -Math.PI / 2, 0]}>
          <Chair x={0} z={0.98} />
        </group>
      </group>
    </group>
  );
}

function MeetingRoom({ room, index }: { room: OfficeRoom; index: number }) {
  const [x, z] = room.position,
    [w, d] = room.size;
  return (
    <group position={[x, 0, z]}>
      <Box p={[0, 0.025, 0]} s={[w, 0.05, d]} color={index % 2 ? '#bbc3b4' : '#c5c9bf'} />
      <Box p={[-w / 2, 1, 0]} s={[0.16, 2, d]} color="#eae7dc" />
      <Box p={[w / 2, 1, 0]} s={[0.16, 2, d]} color="#eae7dc" />
      <Box p={[0, 0.5, d / 2]} s={[w, 1, 0.15]} color="#eae7dc" />
      <mesh position={[0, 1, -d / 2]}>
        <boxGeometry args={[w, 2, 0.04]} />
        <meshPhysicalMaterial
          color="#a9c3b9"
          transparent
          opacity={0.18}
          roughness={0.1}
          depthWrite={false}
        />
      </mesh>
      <Box p={[0, 2, -d / 2]} s={[w, 0.05, 0.05]} color="#73857a" />
      <Box p={[-w / 2, 1, -d / 2]} s={[0.06, 2, 0.07]} color="#73857a" />
      <RoundedBox
        position={[0, 0.9, 0]}
        args={[Math.min(w - 1.1, 1.9), 0.16, Math.min(d - 1.5, 3.5)]}
        radius={0.36}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial color="#caa77b" />
      </RoundedBox>
      <Box p={[0, 0.45, 0]} s={[0.6, 0.9, 0.6]} color="#a38a6b" />
      <Chair x={-1} z={0} rotation={Math.PI / 2} />
      <Chair x={1} z={0} rotation={-Math.PI / 2} />
      {d > 4 && (
        <>
          <Chair x={-1} z={1.3} rotation={Math.PI / 2} />
          <Chair x={1} z={1.3} rotation={-Math.PI / 2} />
          <Chair x={-1} z={-1.3} rotation={Math.PI / 2} />
          <Chair x={1} z={-1.3} rotation={-Math.PI / 2} />
        </>
      )}
      <Plant x={-w / 2 + 0.6} z={d / 2 - 0.6} scale={0.8} />
      <Html position={[0, 1.5, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <span className="room-label">
          {room.name}
          <small>{room.capacity} seats</small>
        </span>
      </Html>
    </group>
  );
}

function CameraRig({ topDown, zoom, reset }: Pick<SceneProps, 'topDown' | 'zoom' | 'reset'>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(topDown ? 0 : -24, topDown ? 45 : 32, topDown ? 0.01 : 24);
    camera.lookAt(0, 0, 0);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(size.width / 43, size.height / 34) * zoom;
      camera.updateProjectionMatrix();
    }
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
  }, [camera, size.width, size.height, topDown, zoom, reset, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2.6}
      minZoom={7}
      maxZoom={65}
      enableRotate={!topDown}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
    />
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        <h3>The 3D map couldn’t start</h3>
        <p>WebGL is unavailable, but the people list is still usable.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function OfficeScene(props: SceneProps) {
  return (
    <SceneBoundary>
      <Canvas
        orthographic
        shadows="percentage"
        dpr={[1, 1.75]}
        frameloop={props.animate && props.people.length ? 'always' : 'demand'}
        camera={{ position: [-24, 32, 24], zoom: 20, near: 0.1, far: 150 }}
        gl={{ antialias: true, alpha: true }}
        fallback={
          <div className="scene-fallback">
            3D is unavailable, but the people list is still usable.
          </div>
        }
      >
        <ambientLight intensity={0.8} />
        <hemisphereLight args={['#fff4db', '#b4b9a2', 0.8]} />
        <directionalLight
          position={[-12, 25, 8]}
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-27}
          shadow-camera-right={27}
          shadow-camera-top={27}
          shadow-camera-bottom={-27}
          shadow-normalBias={0.04}
          shadow-autoUpdate={false}
          shadow-needsUpdate={true}
        />
        <Architecture />
        <OfficeLife
          running={props.animate}
          presentPeople={props.people}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
        />
        {desks.map((desk) => (
          <Workstation key={desk.id} desk={desk} />
        ))}
        {rooms.map((room, index) => (
          <MeetingRoom key={room.id} room={room} index={index} />
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <shadowMaterial transparent opacity={0.15} />
        </mesh>
        <CameraRig topDown={props.topDown} zoom={props.zoom} reset={props.reset} />
      </Canvas>
    </SceneBoundary>
  );
}
