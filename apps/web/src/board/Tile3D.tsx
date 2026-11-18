import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { TileDefinition } from '@prl-oca/shared';

interface Tile3DProps {
  tile: TileDefinition;
  isOccupied: boolean;
  isActiveTile: boolean;
  onSelectTile?: (tile: TileDefinition) => void;
}

const TileIcon3D: React.FC<{ iconType: string; color: string; accent: string }> = ({
  iconType,
  color,
  accent,
}) => {
  switch (iconType) {
    case 'goose_shield':
    case 'shield':
      return (
        <group>
          <mesh castShadow>
            <cylinderGeometry args={[0.32, 0.28, 0.1, 6]} />
            <meshStandardMaterial
              color="#10B981"
              emissive="#10B981"
              emissiveIntensity={0.45}
              metalness={0.6}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color="#FEF08A" metalness={0.8} roughness={0.15} />
          </mesh>
        </group>
      );
    case 'helmet':
    case 'harness':
    case 'goggles':
    case 'mask':
    case 'gloves':
      return (
        <group>
          <mesh castShadow>
            <sphereGeometry args={[0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#FFB800" metalness={0.3} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.01, 0.16]}>
            <boxGeometry args={[0.34, 0.04, 0.16]} />
            <meshStandardMaterial color="#F59E0B" />
          </mesh>
        </group>
      );
    case 'extinguisher':
      return (
        <group>
          <mesh castShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.42, 16]} />
            <meshStandardMaterial color="#EF4444" metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
            <meshStandardMaterial color="#1E293B" metalness={0.8} />
          </mesh>
        </group>
      );
    case 'sign':
    case 'warning':
    case 'alert':
      return (
        <mesh castShadow>
          <coneGeometry args={[0.28, 0.38, 3]} />
          <meshStandardMaterial
            color="#FFB800"
            emissive="#F59E0B"
            emissiveIntensity={0.3}
            metalness={0.3}
            roughness={0.3}
          />
        </mesh>
      );
    case 'bolt':
      return (
        <mesh castShadow rotation={[0, 0, -0.3]}>
          <octahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial
            color="#FDE047"
            emissive="#FACC15"
            emissiveIntensity={0.6}
            metalness={0.5}
            roughness={0.2}
          />
        </mesh>
      );
    case 'first_aid':
    case 'heart':
    case 'stretcher':
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.36, 0.12, 0.12]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.35} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[0.12, 0.36, 0.12]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.35} />
          </mesh>
        </group>
      );
    case 'trophy':
      return (
        <group>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.16, 0.45, 20]} />
            <meshStandardMaterial
              color="#FFB800"
              emissive="#F59E0B"
              emissiveIntensity={0.5}
              metalness={0.85}
              roughness={0.12}
            />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.26, 0.3, 0.12, 20]} />
            <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh castShadow>
          <dodecahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial
            color={accent || color}
            emissive={color}
            emissiveIntensity={0.3}
            metalness={0.55}
            roughness={0.25}
          />
        </mesh>
      );
  }
};

export const Tile3D: React.FC<Tile3DProps> = ({
  tile,
  isOccupied,
  isActiveTile,
  onSelectTile,
}) => {
  const [hovered, setHovered] = useState(false);
  const iconGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const isSpecial =
    tile.type === 'prevencion' ||
    tile.type === 'desafio' ||
    tile.type === 'meta' ||
    tile.type === 'salida';

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (iconGroupRef.current) {
      iconGroupRef.current.rotation.y = t * 0.9 + tile.index * 0.2;
      iconGroupRef.current.position.y =
        0.34 + Math.sin(t * 2.2 + tile.index * 0.4) * (isActiveTile ? 0.09 : 0.04);
    }
    if (ringRef.current) {
      const scale = isActiveTile || hovered ? 1.08 + Math.sin(t * 5) * 0.05 : 1;
      ringRef.current.scale.set(scale, scale, 1);
    }
  });

  const baseSize = tile.type === 'meta' ? 3.2 : 2.35;
  const baseHeight = tile.type === 'meta' ? 0.55 : isSpecial ? 0.38 : 0.28;

  return (
    <group
      position={tile.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelectTile?.(tile);
      }}
    >
      {/* Base biselada 3D de la casilla */}
      <RoundedBox
        args={[baseSize, baseHeight, baseSize]}
        radius={0.1}
        smoothness={3}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color={hovered || isActiveTile ? tile.accentColor : '#1E293B'}
          metalness={0.45}
          roughness={0.35}
          emissive={tile.color}
          emissiveIntensity={isActiveTile ? 0.55 : hovered ? 0.35 : isOccupied ? 0.22 : 0.08}
        />
      </RoundedBox>

      {/* Plataforma superior coloreada en relieve */}
      <RoundedBox
        args={[baseSize * 0.86, 0.08, baseSize * 0.86]}
        radius={0.04}
        position={[0, baseHeight / 2 + 0.03, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color={tile.color}
          metalness={0.35}
          roughness={0.28}
          emissive={tile.color}
          emissiveIntensity={isActiveTile || hovered ? 0.45 : 0.15}
        />
      </RoundedBox>

      {/* Anillo luminoso perimetral para casillas activas o especiales */}
      <mesh
        ref={ringRef}
        position={[0, baseHeight / 2 + 0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[baseSize * 0.36, baseSize * 0.43, 24]} />
        <meshStandardMaterial
          color={tile.accentColor}
          emissive={tile.accentColor}
          emissiveIntensity={isActiveTile ? 1.1 : isSpecial ? 0.6 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Icono 3D flotante de la categoría / tipo de casilla */}
      <group ref={iconGroupRef} position={[0, baseHeight / 2 + 0.34, 0]}>
        <TileIcon3D iconType={tile.icon3D} color={tile.color} accent={tile.accentColor} />
      </group>

      {/* Numeración visible y etiqueta en hover / casilla especial */}
      <Html
        position={[0, baseHeight / 2 + 0.12, baseSize * 0.38]}
        center
        distanceFactor={26}
        zIndexRange={[5, 0]}
      >
        <div
          style={{
            background: isActiveTile ? '#FFB800' : 'rgba(15, 23, 42, 0.88)',
            color: isActiveTile ? '#0F141C' : '#F8FAFC',
            border: `1.5px solid ${tile.accentColor}`,
            borderRadius: '6px',
            padding: '1px 6px',
            fontSize: '11px',
            fontWeight: 900,
            letterSpacing: '0.02em',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: isActiveTile ? '0 0 12px rgba(255,184,0,0.8)' : 'none',
          }}
        >
          #{tile.index} {isSpecial || hovered || isActiveTile ? `· ${tile.name}` : ''}
        </div>
      </Html>
    </group>
  );
};
