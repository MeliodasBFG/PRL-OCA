import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BADGE_DEFINITIONS, BadgeId } from '@prl-oca/shared';
import {
  ClipboardMagnifier3D,
  SafetyHelmet3D,
  SafetySign3D,
} from '../models/PRLModels3D';

interface Badge3DProps {
  badgeId: BadgeId;
  position?: [number, number, number];
  scale?: number;
}

/**
 * Representación 3D detallada de cada una de las 7 insignias preventivas desbloqueables.
 */
export const Badge3D: React.FC<Badge3DProps> = ({
  badgeId,
  position = [0, 0, 0],
  scale = 1,
}) => {
  const ref = useRef<THREE.Group>(null);
  const def = BADGE_DEFINITIONS.find((b) => b.id === badgeId) ?? BADGE_DEFINITIONS[0];

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 1.4;
      ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 2.5) * 0.06;
    }
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      {/* Medalla hexagonal metálica */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.56, 0.56, 0.1, 6]} />
        <meshStandardMaterial
          color={def.color}
          metalness={0.75}
          roughness={0.2}
          emissive={def.color}
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Aro dorado interior */}
      <mesh position={[0, 0, 0.06]}>
        <torusGeometry args={[0.4, 0.045, 12, 24]} />
        <meshStandardMaterial color="#FFB800" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Emblema 3D reconocible según tipo */}
      <group position={[0, 0, 0.12]}>
        {def.iconShape === 'helmet' && <SafetyHelmet3D scale={0.72} position={[0, -0.05, 0]} />}
        {def.iconShape === 'sign' && <SafetySign3D kind="warning" scale={0.55} />}
        {def.iconShape === 'magnifier' && (
          <group>
            <mesh position={[-0.04, 0.05, 0]}>
              <torusGeometry args={[0.14, 0.035, 10, 20]} />
              <meshStandardMaterial color="#FFFFFF" metalness={0.8} />
            </mesh>
            <mesh position={[0.1, -0.1, 0]} rotation={[0, 0, 0.78]}>
              <boxGeometry args={[0.05, 0.22, 0.04]} />
              <meshStandardMaterial color="#FFB800" />
            </mesh>
          </group>
        )}
        {def.iconShape === 'siren' && (
          <mesh>
            <cylinderGeometry args={[0.13, 0.17, 0.24, 16]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#EF4444" emissiveIntensity={0.6} />
          </mesh>
        )}
        {def.iconShape === 'chair' && (
          <group position={[0, -0.1, 0]}>
            <mesh position={[0, 0.04, 0]}>
              <boxGeometry args={[0.24, 0.06, 0.22]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, 0.18, -0.08]}>
              <boxGeometry args={[0.22, 0.26, 0.06]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          </group>
        )}
        {def.iconShape === 'clipboard' && <ClipboardMagnifier3D scale={0.65} />}
        {def.iconShape === 'shield' && (
          <group>
            <mesh>
              <cylinderGeometry args={[0.24, 0.16, 0.08, 6]} />
              <meshStandardMaterial color="#FFFFFF" metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.05, 0.05]}>
              <boxGeometry args={[0.22, 0.06, 0.04]} />
              <meshStandardMaterial color="#10B981" />
            </mesh>
            <mesh position={[0, 0.05, 0.05]}>
              <boxGeometry args={[0.06, 0.22, 0.04]} />
              <meshStandardMaterial color="#10B981" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};
