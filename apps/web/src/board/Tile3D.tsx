import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { TileDefinition } from '@prl-oca/shared';

interface Tile3DProps {
  tile: TileDefinition;
  isOccupied: boolean;
  isActiveTile: boolean;
  hideHtmlOverlays?: boolean;
  onSelectTile?: (tile: TileDefinition) => void;
}

/**
 * Generates a crisp 3D CanvasTexture painted directly onto the top face of the tile
 * so tile numbers (#1..#48) and short names are part of the 3D board surface itself
 * and never cover or block the board with floating DOM elements.
 */
function createTileTopTexture(tile: TileDefinition): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Background fill
    ctx.fillStyle = tile.color;
    ctx.fillRect(0, 0, 256, 256);

    // Inner industrial border frame
    ctx.strokeStyle = tile.accentColor;
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 232, 232);

    // Top-left corner badge for Tile Number
    ctx.fillStyle = 'rgba(15, 20, 28, 0.88)';
    ctx.beginPath();
    ctx.roundRect(22, 22, 92, 52, 10);
    ctx.fill();
    ctx.strokeStyle = tile.accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 32px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${tile.index}`, 68, 49);

    // Bottom label strip with short tile name
    ctx.fillStyle = 'rgba(15, 20, 28, 0.84)';
    ctx.fillRect(18, 186, 220, 52);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 20px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shortName =
      tile.name.length > 18 ? `${tile.name.slice(0, 17).trim()}…` : tile.name;
    ctx.fillText(shortName, 128, 212);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
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
            <cylinderGeometry args={[0.26, 0.22, 0.08, 6]} />
            <meshStandardMaterial
              color="#10B981"
              emissive="#10B981"
              emissiveIntensity={0.45}
              metalness={0.6}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <octahedronGeometry args={[0.13, 0]} />
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
            <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#FFB800" metalness={0.3} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.01, 0.14]}>
            <boxGeometry args={[0.28, 0.035, 0.14]} />
            <meshStandardMaterial color="#F59E0B" />
          </mesh>
        </group>
      );
    case 'extinguisher':
      return (
        <group>
          <mesh castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.34, 16]} />
            <meshStandardMaterial color="#EF4444" metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
            <meshStandardMaterial color="#1E293B" metalness={0.8} />
          </mesh>
        </group>
      );
    case 'sign':
    case 'warning':
    case 'alert':
      return (
        <mesh castShadow>
          <coneGeometry args={[0.22, 0.32, 3]} />
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
          <octahedronGeometry args={[0.21, 0]} />
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
            <boxGeometry args={[0.3, 0.1, 0.1]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.35} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.35} />
          </mesh>
        </group>
      );
    case 'trophy':
      return (
        <group>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.14, 0.4, 20]} />
            <meshStandardMaterial
              color="#FFB800"
              emissive="#F59E0B"
              emissiveIntensity={0.5}
              metalness={0.85}
              roughness={0.12}
            />
          </mesh>
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.22, 0.26, 0.1, 20]} />
            <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh castShadow>
          <dodecahedronGeometry args={[0.19, 0]} />
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
  hideHtmlOverlays = false,
  onSelectTile,
}) => {
  const [hovered, setHovered] = useState(false);
  const iconGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const topTexture = useMemo(() => createTileTopTexture(tile), [tile]);

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
        0.28 + Math.sin(t * 2.2 + tile.index * 0.4) * (isActiveTile ? 0.08 : 0.03);
    }
    if (ringRef.current) {
      const scale = isActiveTile || hovered ? 1.06 + Math.sin(t * 5) * 0.04 : 1;
      ringRef.current.scale.set(scale, scale, 1);
    }
  });

  const baseSize = tile.type === 'meta' ? 3.1 : 2.3;
  const baseHeight = tile.type === 'meta' ? 0.52 : isSpecial ? 0.36 : 0.26;

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
        radius={0.09}
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

      {/* Superficie superior con textura 3D integrada (número + nombre sin tapar el tablero) */}
      <mesh
        position={[0, baseHeight / 2 + 0.015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[baseSize * 0.88, baseSize * 0.88]} />
        <meshStandardMaterial
          map={topTexture}
          metalness={0.18}
          roughness={0.35}
          emissive={tile.color}
          emissiveIntensity={isActiveTile || hovered ? 0.22 : 0.04}
        />
      </mesh>

      {/* Anillo luminoso perimetral para casilla activa o especial */}
      {(isActiveTile || hovered || isSpecial) && (
        <mesh
          ref={ringRef}
          position={[0, baseHeight / 2 + 0.025, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[baseSize * 0.42, baseSize * 0.47, 28]} />
          <meshStandardMaterial
            color={tile.accentColor}
            emissive={tile.accentColor}
            emissiveIntensity={isActiveTile ? 1.1 : hovered ? 0.8 : 0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Icono 3D flotante de la categoría / tipo de casilla */}
      <group ref={iconGroupRef} position={[0, baseHeight / 2 + 0.28, -0.15]}>
        <TileIcon3D iconType={tile.icon3D} color={tile.color} accent={tile.accentColor} />
      </group>

      {/* Tooltip flotante compacto ÚNICAMENTE al pasar el ratón por encima */}
      {!hideHtmlOverlays && hovered && (
        <Html position={[0, baseHeight / 2 + 0.85, 0]} center zIndexRange={[10, 0]}>
          <div className="tile-hover-tooltip">
            <strong>
              #{tile.index} · {tile.name}
            </strong>
            <span>{tile.subtitle}</span>
          </div>
        </Html>
      )}
    </group>
  );
};
