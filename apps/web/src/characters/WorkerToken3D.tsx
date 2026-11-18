import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BOARD_TILES, Team } from '@prl-oca/shared';
import { soundEngine } from '../audio/SoundEngine';
import { SafetyHelmet3D } from '../models/PRLModels3D';

interface WorkerToken3DProps {
  team: Team;
  teamIndex: number;
  totalTeams: number;
  isActiveTurn: boolean;
  reducedMotion?: boolean;
  hideHtmlOverlays?: boolean;
  onActiveTokenProgress?: (
    worldPos: [number, number, number],
    currentTileIndex: number,
    isWalking: boolean
  ) => void;
  onActiveTokenArrive?: () => void;
}

/**
 * Ficha 3D detallada de cada equipo: operario estilizado con botas de seguridad S3,
 * mono de trabajo del color del equipo, chaleco reflectante de alta visibilidad,
 * guantes protectores, gafas panorámicas y casco EN 397 con cresta y visera.
 */
export const WorkerToken3D: React.FC<WorkerToken3DProps> = ({
  team,
  teamIndex,
  totalTeams,
  isActiveTurn,
  reducedMotion = false,
  hideHtmlOverlays = false,
  onActiveTokenProgress,
  onActiveTokenArrive,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const [visualTileIndex, setVisualTileIndex] = useState<number>(team.position);
  const [nextStepTileIndex, setNextStepTileIndex] = useState<number>(team.position);
  const stepProgressRef = useRef<number>(1);
  const isWalkingRef = useRef<boolean>(false);

  const angle = (teamIndex / Math.max(1, totalTeams)) * Math.PI * 2;
  const offsetRadius = totalTeams > 1 ? 0.48 : 0;
  const offsetX = Math.cos(angle) * offsetRadius;
  const offsetZ = Math.sin(angle) * offsetRadius;

  useEffect(() => {
    if (team.position !== visualTileIndex && !isWalkingRef.current) {
      if (reducedMotion) {
        setVisualTileIndex(team.position);
        setNextStepTileIndex(team.position);
        stepProgressRef.current = 1;
        if (isActiveTurn) {
          onActiveTokenArrive?.();
        }
        return;
      }
      isWalkingRef.current = true;
      stepProgressRef.current = 0;
      const dir = team.position > visualTileIndex ? 1 : -1;
      setNextStepTileIndex(visualTileIndex + dir);
    }
  }, [team.position, visualTileIndex, reducedMotion, isActiveTurn, onActiveTokenArrive]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    const currentTile =
      BOARD_TILES.find((tile) => tile.index === visualTileIndex) ?? BOARD_TILES[0];
    const targetStepTile =
      BOARD_TILES.find((tile) => tile.index === nextStepTileIndex) ?? currentTile;

    if (isWalkingRef.current) {
      stepProgressRef.current += Math.min(delta, 0.05) * 1.9;
      const rawP = Math.min(1, stepProgressRef.current);
      const p = rawP * rawP * (3 - 2 * rawP);

      const x =
        THREE.MathUtils.lerp(currentTile.position[0], targetStepTile.position[0], p) + offsetX;
      const z =
        THREE.MathUtils.lerp(currentTile.position[2], targetStepTile.position[2], p) + offsetZ;
      const baseY = THREE.MathUtils.lerp(currentTile.position[1], targetStepTile.position[1], p);
      const jumpArc = Math.sin(rawP * Math.PI) * 0.72;

      groupRef.current.position.set(x, baseY + 0.35 + jumpArc, z);

      if (isActiveTurn) {
        onActiveTokenProgress?.([x, baseY + 0.35, z], nextStepTileIndex, true);
      }

      const dx = targetStepTile.position[0] - currentTile.position[0];
      const dz = targetStepTile.position[2] - currentTile.position[2];
      if (Math.abs(dx) + Math.abs(dz) > 0.01) {
        const targetAngle = Math.atan2(dx, dz);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(
          groupRef.current.rotation.y,
          targetAngle,
          0.25
        );
      }

      const swing = Math.sin(rawP * Math.PI * 2) * 0.65;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing;

      if (rawP >= 1) {
        soundEngine.playSfx('token_step');
        if (nextStepTileIndex !== team.position) {
          const dir = team.position > nextStepTileIndex ? 1 : -1;
          setVisualTileIndex(nextStepTileIndex);
          setNextStepTileIndex(nextStepTileIndex + dir);
          stepProgressRef.current = 0;
        } else {
          isWalkingRef.current = false;
          setVisualTileIndex(team.position);
          if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
          if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
          if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
          if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
          soundEngine.playSfx('tile_arrive');
          if (isActiveTurn) {
            onActiveTokenProgress?.(
              [
                targetStepTile.position[0] + offsetX,
                targetStepTile.position[1] + 0.35,
                targetStepTile.position[2] + offsetZ,
              ],
              team.position,
              false
            );
            onActiveTokenArrive?.();
          }
        }
      }
    } else {
      const idleBounce = isActiveTurn && !reducedMotion ? Math.abs(Math.sin(t * 3.0)) * 0.12 : 0;
      groupRef.current.position.set(
        currentTile.position[0] + offsetX,
        currentTile.position[1] + 0.35 + idleBounce,
        currentTile.position[2] + offsetZ
      );
      if (isActiveTurn && !reducedMotion) {
        groupRef.current.rotation.y = Math.sin(t * 1.4) * 0.3;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Peana circular luminosa del equipo */}
      <mesh position={[0, -0.14, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.42, 0.48, 0.12, 24]} />
        <meshStandardMaterial
          color={team.hexColor}
          metalness={0.45}
          roughness={0.25}
          emissive={team.hexColor}
          emissiveIntensity={isActiveTurn ? 0.8 : 0.25}
        />
      </mesh>

      {/* Piernas con pantalón de trabajo + botas S3 */}
      <group ref={leftLegRef} position={[-0.13, 0.16, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.18, 8, 12]} />
          <meshStandardMaterial color="#1E293B" roughness={0.65} />
        </mesh>
        <RoundedBox args={[0.14, 0.1, 0.24]} radius={0.03} position={[0, -0.14, 0.04]} castShadow>
          <meshStandardMaterial color="#0F172A" roughness={0.7} />
        </RoundedBox>
      </group>
      <group ref={rightLegRef} position={[0.13, 0.16, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.18, 8, 12]} />
          <meshStandardMaterial color="#1E293B" roughness={0.65} />
        </mesh>
        <RoundedBox args={[0.14, 0.1, 0.24]} radius={0.03} position={[0, -0.14, 0.04]} castShadow>
          <meshStandardMaterial color="#0F172A" roughness={0.7} />
        </RoundedBox>
      </group>

      {/* Torso con uniforme del equipo y chaleco reflectante */}
      <RoundedBox args={[0.46, 0.5, 0.3]} radius={0.09} position={[0, 0.52, 0]} castShadow>
        <meshStandardMaterial color={team.hexColor} metalness={0.25} roughness={0.4} />
      </RoundedBox>
      {/* Tiras reflectantes horizontales y verticales */}
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[0.48, 0.06, 0.32]} />
        <meshStandardMaterial color="#FDE047" emissive="#FACC15" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[-0.12, 0.54, 0]}>
        <boxGeometry args={[0.06, 0.44, 0.32]} />
        <meshStandardMaterial color="#FDE047" emissive="#FACC15" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0.12, 0.54, 0]}>
        <boxGeometry args={[0.06, 0.44, 0.32]} />
        <meshStandardMaterial color="#FDE047" emissive="#FACC15" emissiveIntensity={0.45} />
      </mesh>

      {/* Brazos con guantes protectores */}
      <group ref={leftArmRef} position={[-0.31, 0.56, 0]}>
        <mesh position={[0, -0.1, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.24, 8, 12]} />
          <meshStandardMaterial color={team.hexColor} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.26, 0]} castShadow>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#FFB800" />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.31, 0.56, 0]}>
        <mesh position={[0, -0.1, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.24, 8, 12]} />
          <meshStandardMaterial color={team.hexColor} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.26, 0]} castShadow>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color="#FFB800" />
        </mesh>
      </group>

      {/* Cabeza + ojos + gafas panorámicas */}
      <mesh position={[0, 0.94, 0]} castShadow>
        <sphereGeometry args={[0.21, 20, 20]} />
        <meshStandardMaterial color="#FDE68A" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.96, 0.17]}>
        <boxGeometry args={[0.28, 0.09, 0.06]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#0284C7"
          emissiveIntensity={0.4}
          metalness={0.75}
          roughness={0.1}
        />
      </mesh>

      {/* Casco de seguridad industrial detallado */}
      <SafetyHelmet3D color="#FFB800" scale={0.74} position={[0, 1.04, 0]} />

      {!hideHtmlOverlays && isActiveTurn && (
        <Html position={[0, 1.54, 0]} center zIndexRange={[8, 0]}>
          <div
            className="active-token-pill"
            style={{
              background: team.hexColor,
              borderColor: '#FFFFFF',
            }}
          >
            {team.name.split('(')[0].trim()} · #{visualTileIndex}
          </div>
        </Html>
      )}
    </group>
  );
};
