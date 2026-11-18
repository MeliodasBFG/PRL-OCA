import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Team } from '@prl-oca/shared';

const TeamAvatarShowcase: React.FC<{ teams: Team[] }> = ({ teams }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.4;
    }
  });

  const spacing = 2.2;
  const totalWidth = (teams.length - 1) * spacing;

  return (
    <group ref={groupRef} position={[0, -0.8, 0]}>
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <cylinderGeometry args={[5.5, 6.0, 0.35, 36]} />
        <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
      </mesh>

      {teams.map((team, idx) => {
        const x = -totalWidth / 2 + idx * spacing;
        return (
          <group key={team.id} position={[x, 0, 0]}>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.65, 0.75, 0.16, 24]} />
              <meshStandardMaterial
                color={team.hexColor}
                emissive={team.hexColor}
                emissiveIntensity={0.45}
              />
            </mesh>
            <RoundedBox args={[0.6, 0.7, 0.38]} radius={0.1} position={[0, 0.65, 0]} castShadow>
              <meshStandardMaterial color={team.hexColor} metalness={0.3} roughness={0.4} />
            </RoundedBox>
            <mesh position={[0, 1.2, 0]} castShadow>
              <sphereGeometry args={[0.26, 20, 20]} />
              <meshStandardMaterial color="#FDE68A" />
            </mesh>
            <mesh position={[0, 1.35, 0]} castShadow>
              <sphereGeometry args={[0.3, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color="#FFB800" metalness={0.3} roughness={0.25} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export const LobbyScene3D: React.FC<{ teams: Team[] }> = ({ teams }) => {
  return (
    <div className="lobby-canvas-box" aria-label="Vista 3D de equipos en sala de espera">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 2.4, 6.8], fov: 42 }}>
        <color attach="background" args={['#0B111E']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[5, 8, 5]} intensity={1.3} castShadow />
        <TeamAvatarShowcase teams={teams} />
      </Canvas>
    </div>
  );
};
