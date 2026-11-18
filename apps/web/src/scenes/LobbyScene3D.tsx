import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Team } from '@prl-oca/shared';
import { SafetyHelmet3D } from '../models/PRLModels3D';

const TeamAvatarShowcase: React.FC<{ teams: Team[] }> = ({ teams }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.35;
    }
  });

  const spacing = 2.2;
  const totalWidth = (teams.length - 1) * spacing;

  return (
    <group ref={groupRef} position={[0, -0.85, 0]}>
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <cylinderGeometry args={[5.8, 6.3, 0.35, 36]} />
        <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.4} />
      </mesh>

      {teams.map((team, idx) => {
        const x = -totalWidth / 2 + idx * spacing;
        return (
          <group key={team.id} position={[x, 0, 0]}>
            {/* Pedestal luminoso del equipo */}
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.68, 0.78, 0.16, 24]} />
              <meshStandardMaterial
                color={team.hexColor}
                emissive={team.hexColor}
                emissiveIntensity={0.45}
              />
            </mesh>
            {/* Piernas y botas */}
            <mesh position={[-0.14, 0.25, 0]} castShadow>
              <capsuleGeometry args={[0.09, 0.22, 8, 12]} />
              <meshStandardMaterial color="#1E293B" />
            </mesh>
            <mesh position={[0.14, 0.25, 0]} castShadow>
              <capsuleGeometry args={[0.09, 0.22, 8, 12]} />
              <meshStandardMaterial color="#1E293B" />
            </mesh>
            {/* Torso con chaleco reflectante */}
            <RoundedBox args={[0.62, 0.68, 0.4]} radius={0.1} position={[0, 0.72, 0]} castShadow>
              <meshStandardMaterial color={team.hexColor} metalness={0.25} roughness={0.4} />
            </RoundedBox>
            <mesh position={[0, 0.65, 0]}>
              <boxGeometry args={[0.65, 0.08, 0.42]} />
              <meshStandardMaterial color="#FDE047" emissive="#FACC15" emissiveIntensity={0.4} />
            </mesh>
            {/* Cabeza y gafas */}
            <mesh position={[0, 1.26, 0]} castShadow>
              <sphereGeometry args={[0.26, 20, 20]} />
              <meshStandardMaterial color="#FDE68A" />
            </mesh>
            <mesh position={[0, 1.29, 0.22]}>
              <boxGeometry args={[0.34, 0.1, 0.06]} />
              <meshStandardMaterial color="#38BDF8" emissive="#0284C7" emissiveIntensity={0.4} />
            </mesh>
            {/* Casco detallado */}
            <SafetyHelmet3D color="#FFB800" scale={0.9} position={[0, 1.4, 0]} />
          </group>
        );
      })}
    </group>
  );
};

export const LobbyScene3D: React.FC<{ teams: Team[] }> = ({ teams }) => {
  return (
    <div className="lobby-canvas-box" aria-label="Vista 3D de equipos en sala de espera">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 2.3, 6.8], fov: 42 }}>
        <color attach="background" args={['#142033']} />
        <ambientLight intensity={1.0} />
        <hemisphereLight args={['#E0F2FE', '#334155', 0.75]} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
        <TeamAvatarShowcase teams={teams} />
      </Canvas>
    </div>
  );
};
