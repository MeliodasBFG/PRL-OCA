import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { TileDefinition } from '@prl-oca/shared';
import {
  ClipboardMagnifier3D,
  FireExtinguisher3D,
  FirstAidKit3D,
  Gear3D,
  Goggles3D,
  LabFlask3D,
  QuestionMark3D,
  RespiratorMask3D,
  SafetyBoots3D,
  SafetyHarness3D,
  SafetyHelmet3D,
  SafetySign3D,
  Wrench3D,
} from '../models/PRLModels3D';

interface Tile3DProps {
  tile: TileDefinition;
  isOccupied: boolean;
  isActiveTile: boolean;
  hideHtmlOverlays?: boolean;
  onSelectTile?: (tile: TileDefinition) => void;
}

function createTileTopTexture(tile: TileDefinition): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = tile.color;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = tile.accentColor;
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 232, 232);

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
    case 'gate':
      return (
        <group>
          <mesh position={[-0.24, 0.14, 0]} castShadow>
            <boxGeometry args={[0.08, 0.36, 0.08]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
          <mesh position={[0.24, 0.14, 0]} castShadow>
            <boxGeometry args={[0.08, 0.36, 0.08]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[0.62, 0.1, 0.12]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.4} />
          </mesh>
        </group>
      );
    case 'goose_shield':
    case 'shield':
      return (
        <group>
          <mesh castShadow>
            <cylinderGeometry args={[0.26, 0.2, 0.08, 6]} />
            <meshStandardMaterial
              color="#10B981"
              emissive="#10B981"
              emissiveIntensity={0.45}
              metalness={0.5}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.22, 0.04, 0.07]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.07, 0.04, 0.22]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
        </group>
      );
    case 'helmet':
      return <SafetyHelmet3D scale={0.75} />;
    case 'harness':
      return <SafetyHarness3D scale={0.58} position={[0, -0.15, 0]} />;
    case 'goggles':
      return <Goggles3D scale={0.75} />;
    case 'mask':
      return <RespiratorMask3D scale={0.85} />;
    case 'gloves':
      return <SafetyBoots3D scale={0.75} position={[0, -0.1, 0]} />;
    case 'extinguisher':
      return <FireExtinguisher3D variant="abc" scale={0.62} position={[0, -0.18, 0]} />;
    case 'sign':
    case 'warning':
      return <SafetySign3D kind="warning" scale={0.56} />;
    case 'exit':
      return <SafetySign3D kind="exit" scale={0.56} />;
    case 'alert':
    case 'siren':
      return (
        <group>
          <mesh position={[0, 0.08, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.18, 0.26, 16]} />
            <meshStandardMaterial color="#EF4444" emissive="#DC2626" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0, -0.07, 0]}>
            <cylinderGeometry args={[0.22, 0.24, 0.08, 16]} />
            <meshStandardMaterial color="#1E293B" />
          </mesh>
        </group>
      );
    case 'bolt':
      return (
        <group>
          <mesh position={[0.04, 0.1, 0]} rotation={[0, 0, -0.35]} castShadow>
            <boxGeometry args={[0.1, 0.28, 0.08]} />
            <meshStandardMaterial color="#FACC15" emissive="#EAB308" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[-0.04, -0.08, 0]} rotation={[0, 0, -0.35]} castShadow>
            <boxGeometry args={[0.1, 0.28, 0.08]} />
            <meshStandardMaterial color="#FACC15" emissive="#EAB308" emissiveIntensity={0.7} />
          </mesh>
        </group>
      );
    case 'first_aid':
    case 'heart':
    case 'stretcher':
      return <FirstAidKit3D scale={0.75} />;
    case 'gear':
      return <Gear3D color="#FB923C" scale={0.85} />;
    case 'wrench':
      return <Wrench3D scale={0.85} />;
    case 'cube':
    case 'box':
      return (
        <group>
          <RoundedBox args={[0.36, 0.34, 0.36]} radius={0.03} castShadow>
            <meshStandardMaterial color="#D97706" roughness={0.65} />
          </RoundedBox>
          <mesh position={[0, 0.175, 0]}>
            <boxGeometry args={[0.37, 0.02, 0.08]} />
            <meshStandardMaterial color="#FEF08A" />
          </mesh>
        </group>
      );
    case 'flask':
    case 'biohazard':
      return <LabFlask3D scale={0.95} position={[0, -0.15, 0]} />;
    case 'monitor':
      return (
        <group>
          <RoundedBox args={[0.42, 0.28, 0.05]} radius={0.02} position={[0, 0.08, 0]} castShadow>
            <meshStandardMaterial color="#0F172A" />
          </RoundedBox>
          <mesh position={[0, 0.08, 0.03]}>
            <planeGeometry args={[0.36, 0.22]} />
            <meshStandardMaterial color="#38BDF8" emissive="#0284C7" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[0.2, 0.04, 0.16]} />
            <meshStandardMaterial color="#94A3B8" />
          </mesh>
        </group>
      );
    case 'clipboard':
    case 'search':
    case 'chart':
      return <ClipboardMagnifier3D scale={0.82} />;
    case 'forklift':
      return (
        <group>
          <RoundedBox args={[0.36, 0.22, 0.42]} radius={0.04} castShadow>
            <meshStandardMaterial color="#FFB800" />
          </RoundedBox>
          <mesh position={[0, 0.16, 0.22]}>
            <boxGeometry args={[0.26, 0.36, 0.04]} />
            <meshStandardMaterial color="#0F172A" />
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
              emissiveIntensity={0.55}
              metalness={0.85}
              roughness={0.12}
            />
          </mesh>
          <mesh position={[-0.24, 0.2, 0]}>
            <torusGeometry args={[0.1, 0.025, 8, 16]} />
            <meshStandardMaterial color="#FFB800" metalness={0.85} />
          </mesh>
          <mesh position={[0.24, 0.2, 0]}>
            <torusGeometry args={[0.1, 0.025, 8, 16]} />
            <meshStandardMaterial color="#FFB800" metalness={0.85} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.22, 0.26, 0.1, 20]} />
            <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    case 'question':
    case 'brain':
    default:
      return <QuestionMark3D color={accent || color} scale={1.15} />;
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
        0.36 + Math.sin(t * 2.2 + tile.index * 0.4) * (isActiveTile ? 0.08 : 0.03);
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
      <RoundedBox
        args={[baseSize, baseHeight, baseSize]}
        radius={0.09}
        smoothness={3}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color={hovered || isActiveTile ? tile.accentColor : '#334155'}
          metalness={0.4}
          roughness={0.35}
          emissive={tile.color}
          emissiveIntensity={isActiveTile ? 0.55 : hovered ? 0.35 : isOccupied ? 0.22 : 0.08}
        />
      </RoundedBox>

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

      <group ref={iconGroupRef} position={[0, baseHeight / 2 + 0.36, -0.05]}>
        <TileIcon3D iconType={tile.icon3D} color={tile.color} accent={tile.accentColor} />
      </group>

      {!hideHtmlOverlays && hovered && (
        <Html position={[0, baseHeight / 2 + 0.95, 0]} center zIndexRange={[10, 0]}>
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
