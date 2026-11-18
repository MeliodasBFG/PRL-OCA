import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BOARD_TILES, Team } from '@prl-oca/shared';
import { soundEngine } from '../audio/SoundEngine';

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
 * Ficha 3D animada de cada equipo: trabajador con casco de seguridad,
 * uniforme del color del equipo, tiras reflectantes, botas S3 y desplazamiento
 * casilla por casilla a ritmo cinematográfico (~0.52s por casilla).
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
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

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
      // Smooth, readable step speed: ~0.52 seconds per tile hop
      stepProgressRef.current += Math.min(delta, 0.05) * 1.9;
      const rawP = Math.min(1, stepProgressRef.current);
      // Smoothstep easing so each hop accelerates and decelerates naturally
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

      // Face movement direction
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

      // Swing legs & arms while walking
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
      <mesh position={[0, -0.12, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.38, 0.44, 0.12, 24]} />
        <meshStandardMaterial
          color={team.hexColor}
          metalness={0.5}
          roughness={0.25}
          emissive={team.hexColor}
          emissiveIntensity={isActiveTurn ? 0.75 : 0.2}
        />
      </mesh>

      {/* Piernas y Botas de seguridad */}
      <mesh ref={leftLegRef} position={[-0.12, 0.12, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.22, 8, 12]} />
        <meshStandardMaterial color="#1E293B" roughness={0.6} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.12, 0.12, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.22, 8, 12]} />
        <meshStandardMaterial color="#1E293B" roughness={0.6} />
      </mesh>

      {/* Torso con uniforme del color del equipo */}
      <RoundedBox args={[0.44, 0.48, 0.28]} radius={0.08} position={[0, 0.5, 0]} castShadow>
        <meshStandardMaterial color={team.hexColor} metalness={0.25} roughness={0.45} />
      </RoundedBox>

      {/* Bandas reflectantes de alta visibilidad */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.46, 0.06, 0.3]} />
        <meshStandardMaterial
          color="#FDE047"
          emissive="#FDE047"
          emissiveIntensity={0.4}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>

      {/* Brazos */}
      <mesh ref={leftArmRef} position={[-0.3, 0.48, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.26, 8, 12]} />
        <meshStandardMaterial color={team.hexColor} roughness={0.5} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.3, 0.48, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.26, 8, 12]} />
        <meshStandardMaterial color={team.hexColor} roughness={0.5} />
      </mesh>

      {/* Cabeza */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.2, 20, 20]} />
        <meshStandardMaterial color="#FDE68A" roughness={0.45} />
      </mesh>

      {/* Gafas de seguridad transparentes */}
      <mesh position={[0, 0.92, 0.17]}>
        <boxGeometry args={[0.26, 0.08, 0.06]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#0284C7"
          emissiveIntensity={0.35}
          metalness={0.8}
          roughness={0.1}
        />
      </mesh>

      {/* Casco de seguridad industrial */}
      <group position={[0, 1.02, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.23, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#FFB800" metalness={0.3} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.01, 0.14]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.32, 0.03, 0.18]} />
          <meshStandardMaterial color="#F59E0B" metalness={0.3} roughness={0.3} />
        </mesh>
      </group>

      {/* Etiqueta compacta solo para la ficha con el turno activo y cuando no hay modales abiertos */}
      {!hideHtmlOverlays && isActiveTurn && (
        <Html position={[0, 1.48, 0]} center zIndexRange={[8, 0]}>
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
