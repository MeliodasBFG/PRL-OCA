import React, { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  BOARD_TILES,
  CameraViewMode,
  GraphicsQuality,
  Team,
  TileDefinition,
} from '@prl-oca/shared';
import { Tile3D } from '../board/Tile3D';
import { IndustrialZones3D } from '../board/IndustrialZones3D';
import { WorkerToken3D } from '../characters/WorkerToken3D';
import { Dice3D } from '../characters/Dice3D';

interface BoardScene3DProps {
  teams: Team[];
  activeTeamIndex: number;
  diceValues: number[];
  isRolling: boolean;
  cameraView: CameraViewMode;
  graphicsQuality: GraphicsQuality;
  reducedMotion?: boolean;
  onSelectTile?: (tile: TileDefinition) => void;
}

const CameraController: React.FC<{
  cameraView: CameraViewMode;
  activeTilePosition: [number, number, number];
  reducedMotion?: boolean;
}> = ({ cameraView, activeTilePosition, reducedMotion }) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const desiredPos = useRef(new THREE.Vector3(0, 26, 30));
  const desiredTarget = useRef(new THREE.Vector3(0, 0.5, 0));

  useFrame((_, delta) => {
    switch (cameraView) {
      case 'isometric':
        desiredPos.current.set(0, 25, 29);
        desiredTarget.current.set(0, 0.5, 0);
        break;
      case 'path_close':
        desiredPos.current.set(12, 14, 18);
        desiredTarget.current.set(2, 0.6, 2);
        break;
      case 'active_tile':
        desiredPos.current.set(
          activeTilePosition[0] * 0.85,
          activeTilePosition[1] + 9.5,
          activeTilePosition[2] + 11.5
        );
        desiredTarget.current.set(
          activeTilePosition[0],
          activeTilePosition[1] + 0.6,
          activeTilePosition[2]
        );
        break;
      case 'dice':
        desiredPos.current.set(0, 8.5, 11.5);
        desiredTarget.current.set(0, 2.0, 4.2);
        break;
      case 'teams':
        desiredPos.current.set(-16, 15, 22);
        desiredTarget.current.set(-4, 0.6, 4);
        break;
      case 'goal':
        desiredPos.current.set(0, 7.5, 9.5);
        desiredTarget.current.set(0, 1.8, 0);
        break;
    }

    const speed = reducedMotion ? 1 : Math.min(1, delta * 3.2);
    camera.position.lerp(desiredPos.current, speed);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(desiredTarget.current, speed);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      minDistance={5}
      maxDistance={48}
      maxPolarAngle={Math.PI / 2 - 0.06}
    />
  );
};

export const BoardScene3D: React.FC<BoardScene3DProps> = ({
  teams,
  activeTeamIndex,
  diceValues,
  isRolling,
  cameraView,
  graphicsQuality,
  reducedMotion = false,
  onSelectTile,
}) => {
  const activeTeam = teams[activeTeamIndex] ?? teams[0];
  const activeTile =
    BOARD_TILES.find((t) => t.index === activeTeam?.position) ?? BOARD_TILES[0];

  const dpr: [number, number] =
    graphicsQuality === 'baja'
      ? [0.8, 1]
      : graphicsQuality === 'media'
      ? [1, 1.25]
      : graphicsQuality === 'alta'
      ? [1, 1.75]
      : [1.25, 2];

  const enableShadows = graphicsQuality !== 'baja';

  return (
    <div className="canvas-3d-wrapper" aria-label="Escenario 3D del tablero PRL-OCA">
      <Canvas
        shadows={enableShadows}
        dpr={dpr}
        camera={{ position: [0, 25, 29], fov: 44, near: 0.1, far: 150 }}
      >
        <color attach="background" args={['#090D16']} />
        <fog attach="fog" args={['#090D16', 38, 78]} />

        {/* Iluminación ambiental e industrial direccional */}
        <ambientLight intensity={0.65} />
        <hemisphereLight args={['#38BDF8', '#0F172A', 0.55]} />
        <directionalLight
          position={[18, 28, 16]}
          intensity={1.45}
          castShadow={enableShadows}
          shadow-mapSize-width={graphicsQuality === 'ultra' ? 2048 : 1024}
          shadow-mapSize-height={graphicsQuality === 'ultra' ? 2048 : 1024}
          shadow-camera-far={70}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
        <pointLight position={[0, 6, 0]} intensity={1.1} color="#FFB800" distance={18} />

        <CameraController
          cameraView={cameraView}
          activeTilePosition={activeTile.position}
          reducedMotion={reducedMotion}
        />

        {/* Escenario Industrial 3D con las 12 zonas */}
        <IndustrialZones3D reducedMotion={reducedMotion} />

        {/* Las 48 Casillas 3D */}
        {BOARD_TILES.map((tile) => {
          const isOccupied = teams.some((t) => t.position === tile.index);
          const isActiveTile = activeTeam?.position === tile.index;
          return (
            <Tile3D
              key={tile.index}
              tile={tile}
              isOccupied={isOccupied}
              isActiveTile={isActiveTile}
              onSelectTile={onSelectTile}
            />
          );
        })}

        {/* Fichas 3D Animadas de los Equipos */}
        {teams.map((team, idx) => (
          <WorkerToken3D
            key={team.id}
            team={team}
            teamIndex={idx}
            totalTeams={teams.length}
            isActiveTurn={idx === activeTeamIndex}
            reducedMotion={reducedMotion}
          />
        ))}

        {/* Dados 3D con animación de lanzamiento y resultado autoritativo */}
        <Dice3D diceValues={diceValues} isRolling={isRolling} position={[0, 2.3, 4.2]} />

        {/* Partículas ambientales en calidades Media, Alta y Ultra */}
        {graphicsQuality !== 'baja' && !reducedMotion && (
          <Sparkles
            count={graphicsQuality === 'ultra' ? 90 : 45}
            scale={[42, 8, 32]}
            position={[0, 3, 0]}
            size={2.2}
            speed={0.35}
            color="#FFB800"
          />
        )}
      </Canvas>
    </div>
  );
};
