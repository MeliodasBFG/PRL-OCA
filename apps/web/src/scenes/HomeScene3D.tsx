import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Mascot3D } from './Mascot3D';
import {
  FireExtinguisher3D,
  ForkliftDetailed3D,
  Gear3D,
  SafetyHelmet3D,
  SafetySign3D,
} from '../models/PRLModels3D';

const IndustrialHeroStage: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  const platformRef = useRef<THREE.Group>(null);
  const gear1Ref = useRef<THREE.Group>(null);
  const gear2Ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (platformRef.current) {
      platformRef.current.rotation.y = Math.sin(t * 0.25) * 0.32;
    }
    if (gear1Ref.current) {
      gear1Ref.current.rotation.z = t * 0.85;
    }
    if (gear2Ref.current) {
      gear2Ref.current.rotation.z = -t * 1.0;
    }
  });

  return (
    <group ref={platformRef} position={[0, -1.25, 0]}>
      {/* Plataforma circular industrial clara */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[8.5, 9.2, 0.6, 48]} />
        <meshStandardMaterial color="#1E293B" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.4, 7.9, 48]} />
        <meshStandardMaterial color="#FFB800" emissive="#FFB800" emissiveIntensity={0.45} />
      </mesh>

      {/* Mascota central "Prevenito" */}
      <Mascot3D position={[0, 0.05, 1.9]} scale={1.25} mood="happy" />

      {/* Edificio industrial izquierdo + engranaje + casco gigante */}
      <RoundedBox args={[3.2, 3.4, 2.2]} radius={0.12} position={[-4.3, 1.7, -2.4]} castShadow>
        <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.4} />
      </RoundedBox>
      <group ref={gear1Ref} position={[-4.3, 2.4, -1.15]}>
        <Gear3D color="#FFB800" scale={2.4} />
      </group>

      {/* Edificio corporativo derecho + engranaje verde */}
      <RoundedBox args={[3.2, 3.9, 2.2]} radius={0.12} position={[4.3, 1.95, -2.4]} castShadow>
        <meshStandardMaterial color="#0284C7" metalness={0.4} roughness={0.35} />
      </RoundedBox>
      <group ref={gear2Ref} position={[4.3, 2.5, -1.15]}>
        <Gear3D color="#10B981" scale={2.1} />
      </group>

      {/* Señal de advertencia, Extintor, Casco y Carretilla reconocibles */}
      <SafetySign3D kind="warning" position={[-2.9, 0.75, 1.1]} scale={1.1} />
      <FireExtinguisher3D variant="abc" position={[2.8, 0.05, 1.2]} scale={1.25} />
      <SafetyHelmet3D position={[-2.3, 0.08, 2.4]} scale={1.1} />
      <ForkliftDetailed3D position={[3.3, 0.02, -0.2]} rotation={[0, -0.6, 0]} scale={0.95} />
    </group>
  );
};

export const HomeScene3D: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  return (
    <div className="home-canvas-bg" aria-hidden="true">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.5, 9.6], fov: 45 }}>
        <color attach="background" args={['#101A2C']} />
        <fog attach="fog" args={['#101A2C', 14, 30]} />
        <ambientLight intensity={0.95} />
        <hemisphereLight args={['#E0F2FE', '#334155', 0.75]} />
        <directionalLight position={[8, 12, 8]} intensity={1.7} castShadow />
        <pointLight position={[0, 3, 4]} intensity={1.3} color="#38BDF8" />
        <IndustrialHeroStage reducedMotion={reducedMotion} />
        {!reducedMotion && (
          <Sparkles count={45} scale={[16, 6, 12]} size={2} speed={0.4} color="#FFB800" />
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
