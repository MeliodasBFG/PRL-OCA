import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Mascot3D } from './Mascot3D';

const IndustrialHeroStage: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  const platformRef = useRef<THREE.Group>(null);
  const gear1Ref = useRef<THREE.Mesh>(null);
  const gear2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (platformRef.current) {
      platformRef.current.rotation.y = Math.sin(t * 0.28) * 0.35;
    }
    if (gear1Ref.current) {
      gear1Ref.current.rotation.z = t * 0.9;
    }
    if (gear2Ref.current) {
      gear2Ref.current.rotation.z = -t * 1.1;
    }
  });

  return (
    <group ref={platformRef} position={[0, -1.2, 0]}>
      {/* Plataforma circular industrial */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[8.5, 9.2, 0.6, 48]} />
        <meshStandardMaterial color="#0F172A" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.4, 7.9, 48]} />
        <meshStandardMaterial color="#FFB800" emissive="#FFB800" emissiveIntensity={0.4} />
      </mesh>

      {/* Mascota central "Prevenito" */}
      <Mascot3D position={[0, 0.1, 1.8]} scale={1.25} mood="happy" />

      {/* Estructuras industriales de fondo */}
      <RoundedBox args={[3.2, 3.6, 2.2]} radius={0.12} position={[-4.2, 1.8, -2.5]} castShadow>
        <meshStandardMaterial color="#1E293B" metalness={0.55} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[3.2, 4.2, 2.2]} radius={0.12} position={[4.2, 2.1, -2.5]} castShadow>
        <meshStandardMaterial color="#0284C7" metalness={0.45} roughness={0.35} />
      </RoundedBox>

      {/* Engranajes de prevención */}
      <mesh ref={gear1Ref} position={[-4.2, 2.4, -1.2]} castShadow>
        <torusGeometry args={[0.85, 0.2, 12, 18]} />
        <meshStandardMaterial color="#FFB800" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh ref={gear2Ref} position={[4.2, 2.6, -1.2]} castShadow>
        <torusGeometry args={[0.75, 0.18, 12, 18]} />
        <meshStandardMaterial color="#10B981" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Señales triangulares 3D y extintor */}
      <mesh position={[-2.6, 0.8, 1.2]} castShadow>
        <coneGeometry args={[0.55, 0.85, 3]} />
        <meshStandardMaterial color="#FFB800" emissive="#F59E0B" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[2.6, 0.7, 1.2]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.9, 16]} />
        <meshStandardMaterial color="#EF4444" metalness={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
};

export const HomeScene3D: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  return (
    <div className="home-canvas-bg" aria-hidden="true">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.6, 9.5], fov: 45 }}>
        <color attach="background" args={['#070B12']} />
        <fog attach="fog" args={['#070B12', 10, 26]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[8, 12, 8]} intensity={1.4} castShadow />
        <pointLight position={[0, 3, 4]} intensity={1.2} color="#38BDF8" />
        <IndustrialHeroStage reducedMotion={reducedMotion} />
        {!reducedMotion && (
          <Sparkles count={50} scale={[16, 6, 12]} size={2} speed={0.4} color="#FFB800" />
        )}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>
    </div>
  );
};
