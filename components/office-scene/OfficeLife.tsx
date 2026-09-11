'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
export type OfficePerson = { id: string; name: string };
import {
  sampleRoute,
  COFFEE_ROUTE,
  STUDIO_ROUTE,
  KITCHEN_ROUTE,
  CHAT_LEFT,
  CHAT_RIGHT,
  READER,
} from '@/lib/office-model/routes';

const CAST = [
  {
    id: 'coffee-run',
    route: COFFEE_ROUTE,
    offset: 18,
    shirt: '#c97550',
    skin: '#d9a381',
    hair: '#49352a',
  },
  {
    id: 'coffee-return',
    route: COFFEE_ROUTE,
    offset: 38,
    shirt: '#68839d',
    skin: '#965f47',
    hair: '#282424',
  },
  {
    id: 'studio-stroll',
    route: STUDIO_ROUTE,
    offset: 6,
    shirt: '#d6b558',
    skin: '#e4bd9a',
    hair: '#9b7146',
  },
  {
    id: 'kitchen-chat',
    route: KITCHEN_ROUTE,
    offset: 4,
    shirt: '#87996d',
    skin: '#b67f59',
    hair: '#372c26',
  },
  {
    id: 'chat-left',
    route: CHAT_LEFT,
    offset: 2,
    shirt: '#af8291',
    skin: '#e1b594',
    hair: '#6b4934',
  },
  {
    id: 'chat-right',
    route: CHAT_RIGHT,
    offset: 8,
    shirt: '#52867c',
    skin: '#80503c',
    hair: '#302521',
  },
  {
    id: 'reader',
    route: READER,
    offset: 1,
    shirt: '#657392',
    skin: '#d39d76',
    hair: '#a07845',
  },
];
type CharacterProps = (typeof CAST)[number] & {
  running: boolean;
  showBubble: boolean;
  personName: string;
  selected: boolean;
  onSelect: () => void;
};
const LABELS = {
  walking: 'Coffee run',
  coffee: 'Coffee time',
  chatting: 'Catching up',
  reading: 'One more page',
};

function Character({
  id,
  route,
  offset,
  shirt,
  skin,
  hair,
  running,
  showBubble,
  personName,
  selected,
  onSelect,
}: CharacterProps) {
  const body = useRef<Group>(null);
  const leftArm = useRef<Group>(null),
    rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null),
    rightLeg = useRef<Group>(null);
  const head = useRef<Group>(null),
    cup = useRef<Group>(null),
    notebook = useRef<Group>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const time = useRef(offset);
  const initial = sampleRoute(route, offset);
  useFrame((_, delta) => {
    if (!running || !body.current) return;
    time.current += Math.min(delta, 0.05);
    const pose = sampleRoute(route, time.current);
    const walking = pose.activity === 'walking';
    const stride = Math.sin(time.current * 7.5);
    body.current.position.set(
      pose.x,
      walking ? Math.abs(stride) * 0.035 : Math.sin(time.current * 2) * 0.012,
      pose.z
    );
    const difference = Math.atan2(
      Math.sin(pose.facing - body.current.rotation.y),
      Math.cos(pose.facing - body.current.rotation.y)
    );
    body.current.rotation.y += difference * Math.min(delta * 9, 1);
    if (leftLeg.current) leftLeg.current.rotation.x = walking ? stride * 0.48 : 0;
    if (rightLeg.current) rightLeg.current.rotation.x = walking ? -stride * 0.48 : 0;
    if (leftArm.current)
      leftArm.current.rotation.x = walking
        ? -stride * 0.4
        : pose.activity === 'reading'
          ? -1
          : -0.15;
    if (rightArm.current) {
      rightArm.current.rotation.x = walking
        ? stride * 0.4
        : pose.activity === 'coffee'
          ? -1.1 - Math.sin(time.current * 1.2) * 0.25
          : pose.activity === 'reading'
            ? -1
            : -0.5 - Math.sin(time.current * 2.2) * 0.25;
      rightArm.current.rotation.z =
        pose.activity === 'chatting' ? -0.22 - Math.sin(time.current * 1.7) * 0.14 : -0.08;
    }
    if (head.current)
      head.current.rotation.x =
        pose.activity === 'reading' ? 0.2 : Math.sin(time.current * 1.8) * 0.07;
    if (cup.current) cup.current.visible = pose.activity === 'coffee';
    if (notebook.current) notebook.current.visible = pose.activity === 'reading';
    if (bubble.current) {
      const label =
        pose.activity === 'walking' && route !== COFFEE_ROUTE
          ? 'Stretching my legs'
          : LABELS[pose.activity];
      if (bubble.current.textContent !== label) bubble.current.textContent = label;
    }
  });
  return (
    <group
      ref={body}
      name={`office-life-${id}`}
      position={[initial.x, 0, initial.z]}
      rotation={[0, initial.facing, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={(event) => event.stopPropagation()}
    >
      {selected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.45, 32]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} scale={[1, 0.7, 1]}>
        <circleGeometry args={[0.32, 20]} />
        <meshBasicMaterial color="#4b513f" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <capsuleGeometry args={[0.21, 0.38, 4, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.95} />
      </mesh>
      <group ref={head} position={[0, 1.3, 0]}>
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.215, 12, 10]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        <mesh position={[0, 0.21, -0.035]} scale={[1.04, 0.8, 1.04]}>
          <sphereGeometry args={[0.218, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.75]} />
          <meshStandardMaterial color={hair} />
        </mesh>
        <mesh position={[0, 0.14, 0.2]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <group key={side} ref={side === -1 ? leftLeg : rightLeg} position={[side * 0.105, 0.61, 0]}>
          <mesh position={[0, -0.24, 0]}>
            <capsuleGeometry args={[0.075, 0.34, 3, 7]} />
            <meshStandardMaterial color="#3c494b" />
          </mesh>
          <mesh position={[0, -0.51, 0.05]}>
            <boxGeometry args={[0.16, 0.105, 0.27]} />
            <meshStandardMaterial color="#f2e9d8" />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} ref={side === -1 ? leftArm : rightArm} position={[side * 0.25, 1.05, 0]}>
          <mesh position={[0, -0.14, 0]}>
            <capsuleGeometry args={[0.07, 0.19, 3, 7]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          <mesh position={[0, -0.34, 0]}>
            <capsuleGeometry args={[0.06, 0.11, 3, 7]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {side === 1 && (
            <group ref={cup} position={[0, -0.4, 0.08]} visible={initial.activity === 'coffee'}>
              <mesh>
                <cylinderGeometry args={[0.07, 0.055, 0.13, 10]} />
                <meshStandardMaterial color="#fbedd5" />
              </mesh>
              <mesh position={[0.08, 0, 0]}>
                <torusGeometry args={[0.035, 0.012, 5, 10]} />
                <meshStandardMaterial color="#fbedd5" />
              </mesh>
            </group>
          )}
        </group>
      ))}
      <group
        ref={notebook}
        position={[0, 0.92, 0.34]}
        rotation={[-0.4, 0, 0]}
        visible={initial.activity === 'reading'}
      >
        <mesh>
          <boxGeometry args={[0.32, 0.035, 0.26]} />
          <meshStandardMaterial color="#d2a26a" />
        </mesh>
        <mesh position={[0, 0.023, 0]}>
          <boxGeometry args={[0.27, 0.015, 0.22]} />
          <meshStandardMaterial color="#f8f1dd" />
        </mesh>
      </group>
      {showBubble && (
        <Html
          position={[0, 1.92, 0]}
          center
          zIndexRange={[12, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="ambient-bubble" aria-hidden="true" data-person-id={id}>
            <strong>{personName.split(' ')[0]}</strong>
            <span ref={bubble}>{LABELS[initial.activity]}</span>
          </span>
        </Html>
      )}
    </group>
  );
}
function CoffeeSteam({ running }: { running: boolean }) {
  const puffs = useRef<(Mesh | null)[]>([]);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!running) return;
    time.current += Math.min(delta, 0.05);
    puffs.current.forEach((puff, i) => {
      if (!puff) return;
      const phase = (time.current * 0.4 + i / 4) % 1;
      puff.position.set(
        Math.sin(phase * 6 + i) * 0.07,
        phase * 0.7,
        Math.cos(phase * 4 + i) * 0.05
      );
      puff.scale.setScalar(0.5 + phase);
      (puff.material as MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.26;
    });
  });
  return (
    <group position={[-4.98, 1.87, -12]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          ref={(node) => {
            puffs.current[i] = node;
          }}
          key={i}
          position={[0, i * 0.16, 0]}
        >
          <sphereGeometry args={[0.065, 7, 6]} />
          <meshBasicMaterial color="#fffcf0" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
export default function OfficeLife({
  running,
  presentPeople,
  selectedId,
  onSelect,
}: {
  running: boolean;
  presentPeople: OfficePerson[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <group name="office-life">
      <CoffeeSteam running={running && presentPeople.length > 0} />
      {presentPeople.map((person) => {
        const index = Array.from(person.id).reduce(
          (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
          0
        );
        const base = CAST[index % CAST.length];
        const route =
          index >= CAST.length && [CHAT_LEFT, CHAT_RIGHT, READER].includes(base.route)
            ? index % 2
              ? COFFEE_ROUTE
              : STUDIO_ROUTE
            : base.route;
        return (
          <Character
            key={person.id}
            {...base}
            id={person.id}
            personName={person.name}
            route={route}
            offset={base.offset + (Math.floor(index / CAST.length) % 41) * 17}
            running={running}
            showBubble={selectedId === person.id}
            selected={selectedId === person.id}
            onSelect={() => onSelect(person.id)}
          />
        );
      })}
    </group>
  );
}
