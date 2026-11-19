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
    <group ref={platformRef} position={[3.3, -1.1, 0]}>
      {/* Plataforma circular industrial clara */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[6.8, 7.4, 0.55, 48]} />
        <meshStandardMaterial color="#334155" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.9, 6.4, 48]} />
        <meshStandardMaterial color="#FFB800" emissive="#FFB800" emissiveIntensity={0.55} />
      </mesh>

      {/* Mascota central "Prevenito" de pie sobre la plataforma */}
      <Mascot3D position={[0, 0.0, 1.4]} scale={1.2} mood="happy" />

      {/* Edificio industrial izquierdo + eje de transmisión + engranaje */}
      <RoundedBox args={[2.8, 3.1, 2.0]} radius={0.12} position={[-3.4, 1.55, -2.0]} castShadow>
        <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.4} />
      </RoundedBox>
      <mesh position={[-3.4, 2.2, -0.95]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.3, 14]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={gear1Ref} position={[-3.4, 2.2, -0.82]}>
        <Gear3D color="#FFB800" scale={2.1} />
      </group>

      {/* Edificio corporativo derecho + eje de transmisión + engranaje verde */}
      <RoundedBox args={[2.8, 3.6, 2.0]} radius={0.12} position={[3.4, 1.8, -2.0]} castShadow>
        <meshStandardMaterial color="#0284C7" metalness={0.35} roughness={0.35} />
      </RoundedBox>
      <mesh position={[3.4, 2.3, -0.95]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.3, 14]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={gear2Ref} position={[3.4, 2.3, -0.82]}>
        <Gear3D color="#10B981" scale={1.9} />
      </group>

      {/* Señal de advertencia CON POSTE Y PEANA, Extintor en suelo, Casco sobre peana y Carretilla */}
      <SafetySign3D kind="warning" withPost={true} postHeight={0.95} position={[-2.4, 0.95, 1.0]} scale={1.0} />
      <FireExtinguisher3D variant="abc" position={[2.2, 0.0, 1.3]} scale={1.2} />
      <group position={[-1.9, 0, 2.2]}>
        <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.48, 0.36, 20]} />
          <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
        </mesh>
        <SafetyHelmet3D position={[0, 0.36, 0]} scale={1.05} />
      </group>
      <ForkliftDetailed3D position={[2.5, 0.0, -0.3]} rotation={[0, -0.65, 0]} scale={0.95} />
    </group>
  );
};

export const HomeScene3D: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  return (
    <div className="home-canvas-bg" aria-hidden="true">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0.6, 3.2, 10.4], fov: 44 }}>
        <color attach="background" args={['#18253A']} />
        <fog attach="fog" args={['#18253A', 18, 36]} />
        <ambientLight intensity={1.15} />
        <hemisphereLight args={['#E0F2FE', '#475569', 0.9]} />
        <directionalLight position={[8, 12, 8]} intensity={1.85} castShadow />
        <pointLight position={[3, 4, 5]} intensity={1.4} color="#FFFFFF" />
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
