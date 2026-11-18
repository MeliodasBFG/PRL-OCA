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
}

/**
 * Ficha 3D animada de cada equipo: trabajador con casco de seguridad,
 * uniforme del color del equipo, tiras reflectantes, botas S3 y desplazamiento
 * casilla por casilla (nunca se teletransporta directamente).
 */
export const WorkerToken3D: React.FC<WorkerToken3DProps> = ({
  team,
  teamIndex,
  totalTeams,
  isActiveTurn,
  reducedMotion = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  // Track visual tile index so token walks step-by-step from previous tile to target tile
  const [visualTileIndex, setVisualTileIndex] = useState<number>(team.position);
  const [nextStepTileIndex, setNextStepTileIndex] = useState<number>(team.position);
  const stepProgressRef = useRef<number>(1);
  const isWalkingRef = useRef<boolean>(false);

  // Calculate small radial offset so multiple tokens on the same tile don't overlap
  const angle = (teamIndex / Math.max(1, totalTeams)) * Math.PI * 2;
  const offsetRadius = totalTeams > 1 ? 0.52 : 0;
  const offsetX = Math.cos(angle) * offsetRadius;
  const offsetZ = Math.sin(angle) * offsetRadius;

  useEffect(() => {
    if (team.position !== visualTileIndex && !isWalkingRef.current) {
      if (reducedMotion) {
        setVisualTileIndex(team.position);
        setNextStepTileIndex(team.position);
        stepProgressRef.current = 1;
        return;
      }
      isWalkingRef.current = true;
      stepProgressRef.current = 0;
      const dir = team.position > visualTileIndex ? 1 : -1;
      setNextStepTileIndex(visualTileIndex + dir);
    }
  }, [team.position, visualTileIndex, reducedMotion]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    const currentTile =
      BOARD_TILES.find((tile) => tile.index === visualTileIndex) ?? BOARD_TILES[0];
    const targetStepTile =
      BOARD_TILES.find((tile) => tile.index === nextStepTileIndex) ?? currentTile;

    if (isWalkingRef.current) {
      stepProgressRef.current += delta * 4.2; // ~0.24s per tile hop
      const p = Math.min(1, stepProgressRef.current);

      const x = THREE.MathUtils.lerp(currentTile.position[0], targetStepTile.position[0], p) + offsetX;
      const z = THREE.MathUtils.lerp(currentTile.position[2], targetStepTile.position[2], p) + offsetZ;
      const baseY = THREE.MathUtils.lerp(currentTile.position[1], targetStepTile.position[1], p);
      const jumpArc = Math.sin(p * Math.PI) * 0.65;

      groupRef.current.position.set(x, baseY + 0.35 + jumpArc, z);

      // Face movement direction
      const dx = targetStepTile.position[0] - currentTile.position[0];
      const dz = targetStepTile.position[2] - currentTile.position[2];
      if (Math.abs(dx) + Math.abs(dz) > 0.01) {
        groupRef.current.rotation.y = Math.atan2(dx, dz);
      }

      // Swing legs & arms while walking
      const swing = Math.sin(p * Math.PI * 2) * 0.6;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing;

      if (p >= 1) {
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
        }
      }
    } else {
      const idleBounce = isActiveTurn && !reducedMotion ? Math.abs(Math.sin(t * 3.5)) * 0.14 : 0;
      groupRef.current.position.set(
        currentTile.position[0] + offsetX,
        currentTile.position[1] + 0.35 + idleBounce,
        currentTile.position[2] + offsetZ
      );
      if (isActiveTurn && !reducedMotion) {
        groupRef.current.rotation.y = Math.sin(t * 1.5) * 0.35;
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
          emissiveIntensity={isActiveTurn ? 0.65 : 0.18}
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

      {/* Etiqueta flotante del equipo */}
      <Html position={[0, 1.48, 0]} center distanceFactor={22} zIndexRange={[10, 0]}>
        <div
          style={{
            background: isActiveTurn ? team.hexColor : 'rgba(15, 20, 28, 0.88)',
            color: '#FFFFFF',
            border: `2px solid ${team.hexColor}`,
            borderRadius: '999px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
            pointerEvents: 'none',
          }}
        >
          {team.name.split('(')[0].trim()} · #{team.position}
        </div>
      </Html>
    </group>
  );
};
