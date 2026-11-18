import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

export interface Mascot3DProps {
  position?: [number, number, number];
  scale?: number;
  mood?: 'idle' | 'happy' | 'alert' | 'celebrate';
}

/**
 * "PREVENITO" - Mascota 3D original de PRL-OCA 3D.
 * Robot-inspector de seguridad con casco amarillo EN-397, visor digital,
 * chaleco reflectante de alta visibilidad y escudo preventivo.
 */
export const Mascot3D: React.FC<Mascot3DProps> = ({
  position = [0, 0, 0],
  scale = 1,
  mood = 'idle',
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const floatSpeed = mood === 'celebrate' ? 6 : 2.5;
      const floatAmp = mood === 'celebrate' ? 0.18 : 0.08;
      groupRef.current.position.y = position[1] + Math.sin(t * floatSpeed) * floatAmp;
      groupRef.current.rotation.y =
        mood === 'celebrate' ? t * 2.2 : Math.sin(t * 1.1) * 0.25;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.z =
        mood === 'happy' || mood === 'celebrate'
          ? Math.PI * 0.65 + Math.sin(t * 8) * 0.25
          : Math.sin(t * 2) * 0.15;
    }
    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(t * (mood === 'alert' ? 12 : 4)) * 0.6;
    }
  });

  const visorColor =
    mood === 'alert' ? '#FF5722' : mood === 'happy' || mood === 'celebrate' ? '#10B981' : '#38BDF8';

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Torso con chaleco reflectante */}
      <RoundedBox args={[0.75, 0.85, 0.52]} radius={0.14} smoothness={4} position={[0, 0.8, 0]} castShadow>
        <meshStandardMaterial color="#0284C7" metalness={0.35} roughness={0.4} />
      </RoundedBox>

      {/* Bandas reflectantes del chaleco */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.78, 0.1, 0.55]} />
        <meshStandardMaterial
          color="#E2E8F0"
          emissive="#FDE047"
          emissiveIntensity={0.45}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow>
        <boxGeometry args={[0.78, 0.08, 0.55]} />
        <meshStandardMaterial
          color="#FFB800"
          emissive="#FFB800"
          emissiveIntensity={0.35}
          metalness={0.5}
          roughness={0.25}
        />
      </mesh>

      {/* Cabeza y Visor */}
      <RoundedBox args={[0.66, 0.54, 0.54]} radius={0.14} smoothness={4} position={[0, 1.56, 0]} castShadow>
        <meshStandardMaterial color="#F8FAFC" metalness={0.3} roughness={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.54, 0.26, 0.08]} radius={0.04} position={[0, 1.56, 0.26]}>
        <meshStandardMaterial
          color="#0F172A"
          emissive={visorColor}
          emissiveIntensity={0.55}
          metalness={0.8}
          roughness={0.15}
        />
      </RoundedBox>

      {/* Ojos LED en el visor */}
      <mesh position={[-0.13, 1.57, 0.31]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive={visorColor} emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[0.13, 1.57, 0.31]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive={visorColor} emissiveIntensity={1.6} />
      </mesh>

      {/* Casco de Seguridad Industrial Amarillo */}
      <group position={[0, 1.82, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.42, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#FFB800" metalness={0.25} roughness={0.25} />
        </mesh>
        {/* Visera del casco */}
        <mesh position={[0, 0.02, 0.24]} rotation={[0.15, 0, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.45, 0.06, 24, 1, false, -Math.PI * 0.4, Math.PI * 0.8]} />
          <meshStandardMaterial color="#F59E0B" metalness={0.3} roughness={0.3} />
        </mesh>
        {/* Linterna frontal / Baliza LED */}
        <mesh ref={beaconRef} position={[0, 0.22, 0.34]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive={mood === 'alert' ? '#EF4444' : '#38BDF8'}
            emissiveIntensity={1.2}
          />
        </mesh>
      </group>

      {/* Brazo Izquierdo con Escudo PRL */}
      <group position={[-0.5, 0.95, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.35, 8, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Escudo octogonal verde de seguridad */}
        <mesh position={[-0.12, -0.32, 0.18]} rotation={[0, -0.3, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.26, 0.06, 8]} />
          <meshStandardMaterial
            color="#10B981"
            emissive="#059669"
            emissiveIntensity={0.3}
            metalness={0.4}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* Brazo Derecho Animado (Saludo) */}
      <group ref={rightArmRef} position={[0.5, 0.98, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.36, 8, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Guante de protección naranja */}
        <mesh position={[0, -0.45, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#EA580C" roughness={0.5} />
        </mesh>
      </group>

      {/* Botas de seguridad S3 */}
      <RoundedBox args={[0.24, 0.22, 0.36]} radius={0.05} position={[-0.2, 0.16, 0.05]} castShadow>
        <meshStandardMaterial color="#1E293B" metalness={0.4} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.24, 0.22, 0.36]} radius={0.05} position={[0.2, 0.16, 0.05]} castShadow>
        <meshStandardMaterial color="#1E293B" metalness={0.4} roughness={0.6} />
      </RoundedBox>
    </group>
  );
};
