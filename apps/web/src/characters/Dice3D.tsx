import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface Dice3DProps {
  diceValues: number[]; // [d1] or [d1, d2]
  isRolling: boolean;
  position?: [number, number, number];
}

/**
 * Rotations so that the desired face (1..6) is on top (+Y axis).
 */
const TOP_FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, 0, Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI, 0, 0],
};

const SingleDie3D: React.FC<{
  value: number;
  isRolling: boolean;
  offset: [number, number, number];
}> = ({ value, isRolling, offset }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bounceRef = useRef<number>(0);

  useEffect(() => {
    if (!isRolling) {
      bounceRef.current = 1.0;
    }
  }, [isRolling, value]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (isRolling) {
      groupRef.current.rotation.x += delta * 14;
      groupRef.current.rotation.y += delta * 17;
      groupRef.current.rotation.z += delta * 11;
      groupRef.current.position.set(
        offset[0] + Math.sin(Date.now() * 0.02) * 0.25,
        offset[1] + 1.4 + Math.abs(Math.sin(Date.now() * 0.015)) * 0.9,
        offset[2]
      );
    } else {
      if (bounceRef.current > 0) {
        bounceRef.current = Math.max(0, bounceRef.current - delta * 2.5);
      }
      const b = bounceRef.current;
      const bounceHeight = Math.abs(Math.sin(b * Math.PI * 3)) * b * 0.8;
      const targetRot = TOP_FACE_ROTATIONS[value] ?? TOP_FACE_ROTATIONS[1];

      groupRef.current.position.lerp(
        new THREE.Vector3(offset[0], offset[1] + bounceHeight, offset[2]),
        0.22
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        targetRot[0],
        0.25
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRot[1],
        0.25
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        targetRot[2],
        0.25
      );
    }
  });

  const s = 0.52; // Half-size offset for pips

  return (
    <group ref={groupRef} position={offset}>
      <RoundedBox args={[1.0, 1.0, 1.0]} radius={0.14} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#F8FAFC" metalness={0.15} roughness={0.2} />
      </RoundedBox>

      {/* Cara 1 (+Y arriba): 1 punto central amarillo/naranja */}
      <mesh position={[0, s, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color="#EA580C" roughness={0.3} />
      </mesh>

      {/* Cara 6 (-Y abajo): 6 puntos */}
      {[
        [-0.24, -s, -0.24],
        [-0.24, -s, 0],
        [-0.24, -s, 0.24],
        [0.24, -s, -0.24],
        [0.24, -s, 0],
        [0.24, -s, 0.24],
      ].map((pos, idx) => (
        <mesh key={`f6_${idx}`} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      ))}

      {/* Cara 2 (+X derecha): 2 puntos */}
      {[
        [s, -0.22, -0.22],
        [s, 0.22, 0.22],
      ].map((pos, idx) => (
        <mesh key={`f2_${idx}`} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      ))}

      {/* Cara 5 (-X izquierda): 5 puntos */}
      {[
        [-s, 0, 0],
        [-s, -0.24, -0.24],
        [-s, -0.24, 0.24],
        [-s, 0.24, -0.24],
        [-s, 0.24, 0.24],
      ].map((pos, idx) => (
        <mesh key={`f5_${idx}`} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      ))}

      {/* Cara 3 (+Z frente): 3 puntos */}
      {[
        [-0.24, -0.24, s],
        [0, 0, s],
        [0.24, 0.24, s],
      ].map((pos, idx) => (
        <mesh key={`f3_${idx}`} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      ))}

      {/* Cara 4 (-Z atrás): 4 puntos */}
      {[
        [-0.24, -0.24, -s],
        [0.24, -0.24, -s],
        [-0.24, 0.24, -s],
        [0.24, 0.24, -s],
      ].map((pos, idx) => (
        <mesh key={`f4_${idx}`} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      ))}
    </group>
  );
};

export const Dice3D: React.FC<Dice3DProps> = ({
  diceValues,
  isRolling,
  position = [0, 2.2, 4.2],
}) => {
  const count = diceValues.length > 1 ? 2 : 1;
  return (
    <group position={position}>
      {count === 1 ? (
        <SingleDie3D value={diceValues[0] ?? 1} isRolling={isRolling} offset={[0, 0, 0]} />
      ) : (
        <>
          <SingleDie3D
            value={diceValues[0] ?? 1}
            isRolling={isRolling}
            offset={[-0.75, 0, 0]}
          />
          <SingleDie3D
            value={diceValues[1] ?? 1}
            isRolling={isRolling}
            offset={[0.75, 0, 0]}
          />
        </>
      )}
    </group>
  );
};
