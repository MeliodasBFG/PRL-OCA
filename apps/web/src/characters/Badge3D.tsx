import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BADGE_DEFINITIONS, BadgeId } from '@prl-oca/shared';

interface Badge3DProps {
  badgeId: BadgeId;
  position?: [number, number, number];
  scale?: number;
}

/**
 * Representación 3D de cada una de las 7 insignias preventivas desbloqueables.
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
      {/* Medalla exterior biselada */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.1, 6]} />
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
        <torusGeometry args={[0.38, 0.04, 12, 24]} />
        <meshStandardMaterial color="#FFB800" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Emblema central 3D según tipo */}
      <mesh position={[0, 0, 0.08]}>
        {def.iconShape === 'helmet' && <sphereGeometry args={[0.2, 16, 16]} />}
        {def.iconShape === 'sign' && <coneGeometry args={[0.22, 0.32, 3]} />}
        {def.iconShape === 'magnifier' && <torusGeometry args={[0.15, 0.04, 12, 20]} />}
        {def.iconShape === 'siren' && <cylinderGeometry args={[0.14, 0.18, 0.25, 16]} />}
        {def.iconShape === 'chair' && <boxGeometry args={[0.22, 0.26, 0.16]} />}
        {def.iconShape === 'clipboard' && <boxGeometry args={[0.22, 0.28, 0.06]} />}
        {def.iconShape === 'shield' && <octahedronGeometry args={[0.22, 0]} />}
        <meshStandardMaterial color="#FFFFFF" metalness={0.5} roughness={0.2} />
      </mesh>
    </group>
  );
};
