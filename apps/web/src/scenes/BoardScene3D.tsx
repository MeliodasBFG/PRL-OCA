import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  cameraResetKey?: number;
  cameraZoomDelta?: number;
  graphicsQuality: GraphicsQuality;
  reducedMotion?: boolean;
  hideHtmlOverlays?: boolean;
  onSelectTile?: (tile: TileDefinition) => void;
  onActiveTokenArrive?: () => void;
}

const CameraController: React.FC<{
  cameraView: CameraViewMode;
  cameraResetKey: number;
  cameraZoomDelta: number;
  trackedPosition: [number, number, number];
  isTokenWalking: boolean;
  reducedMotion?: boolean;
}> = ({
  cameraView,
  cameraResetKey,
  cameraZoomDelta,
  trackedPosition,
  isTokenWalking,
  reducedMotion,
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const desiredPos = useRef(new THREE.Vector3(0, 25, 29));
  const desiredTarget = useRef(new THREE.Vector3(0, 0.5, 0));
  const transitionRemainingRef = useRef<number>(1.0);
  const userInteractingRef = useRef<boolean>(false);

  useEffect(() => {
    userInteractingRef.current = false;
    transitionRemainingRef.current = reducedMotion ? 0.15 : 1.1;
  }, [cameraView, cameraResetKey, reducedMotion]);

  useEffect(() => {
    if (cameraZoomDelta === 0 || !controlsRef.current) return;
    const target = controlsRef.current.target;
    const offset = camera.position.clone().sub(target);
    const scale = cameraZoomDelta > 0 ? 0.82 : 1.22;
    offset.multiplyScalar(scale);
    const dist = offset.length();
    if (dist >= 6 && dist <= 46) {
      camera.position.copy(target).add(offset);
      controlsRef.current.update();
    }
  }, [cameraZoomDelta, camera]);

  useFrame((_, delta) => {
    switch (cameraView) {
      case 'isometric':
        desiredPos.current.set(0, 29, 34);
        desiredTarget.current.set(0, 0.2, 0);
        break;
      case 'path_close':
        desiredPos.current.set(12, 14, 18);
        desiredTarget.current.set(2, 0.6, 2);
        break;
      case 'active_tile':
        desiredPos.current.set(
          trackedPosition[0] * 0.82,
          trackedPosition[1] + 9.2,
          trackedPosition[2] + 11.2
        );
        desiredTarget.current.set(
          trackedPosition[0],
          trackedPosition[1] + 0.5,
          trackedPosition[2]
        );
        break;
      case 'dice':
        desiredPos.current.set(1.5, 8.6, 12.6);
        desiredTarget.current.set(1.5, 2.0, 5.5);
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

    const shouldFollow =
      !userInteractingRef.current &&
      (transitionRemainingRef.current > 0 || (isTokenWalking && cameraView === 'active_tile'));

    if (shouldFollow) {
      transitionRemainingRef.current = Math.max(0, transitionRemainingRef.current - delta);
      const speed = reducedMotion ? 1 : Math.min(1, delta * 3.8);
      camera.position.lerp(desiredPos.current, speed);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(desiredTarget.current, speed);
        controlsRef.current.update();
      }
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
      onStart={() => {
        userInteractingRef.current = true;
        transitionRemainingRef.current = 0;
      }}
    />
  );
};

export const BoardScene3D: React.FC<BoardScene3DProps> = ({
  teams,
  activeTeamIndex,
  diceValues,
  isRolling,
  cameraView,
  cameraResetKey = 0,
  cameraZoomDelta = 0,
  graphicsQuality,
  reducedMotion = false,
  hideHtmlOverlays = false,
  onSelectTile,
  onActiveTokenArrive,
}) => {
  const activeTeam = teams[activeTeamIndex] ?? teams[0];
  const activeTile =
    BOARD_TILES.find((t) => t.index === activeTeam?.position) ?? BOARD_TILES[0];

  const [liveWalkPos, setLiveWalkPos] = useState<[number, number, number] | null>(null);
  const [liveWalkTileIndex, setLiveWalkTileIndex] = useState<number>(activeTile.index);
  const [isTokenWalking, setIsTokenWalking] = useState<boolean>(false);

  const handleTokenProgress = useCallback(
    (pos: [number, number, number], stepTileIdx: number, walking: boolean) => {
      setLiveWalkPos(walking ? pos : null);
      setLiveWalkTileIndex(stepTileIdx);
      setIsTokenWalking(walking);
    },
    []
  );

  const trackedPosition = liveWalkPos ?? activeTile.position;

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
        camera={{ position: [0, 29, 34], fov: 44, near: 0.1, far: 160 }}
      >
        {/* Iluminación brillante y equilibrada para que todos los modelos 3D sean nítidos */}
        <color attach="background" args={['#121C2D']} />
        <fog attach="fog" args={['#121C2D', 48, 92]} />

        <ambientLight intensity={0.95} />
        <hemisphereLight args={['#E0F2FE', '#334155', 0.8]} />
        <directionalLight
          position={[18, 28, 16]}
          intensity={1.75}
          castShadow={enableShadows}
          shadow-mapSize-width={graphicsQuality === 'ultra' ? 2048 : 1024}
          shadow-mapSize-height={graphicsQuality === 'ultra' ? 2048 : 1024}
          shadow-camera-far={70}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
        <directionalLight position={[-16, 14, -14]} intensity={0.7} color="#93C5FD" />
        <pointLight position={[0, 6, 0]} intensity={1.1} color="#FFB800" distance={18} />

        <CameraController
          cameraView={cameraView}
          cameraResetKey={cameraResetKey}
          cameraZoomDelta={cameraZoomDelta}
          trackedPosition={trackedPosition}
          isTokenWalking={isTokenWalking}
          reducedMotion={reducedMotion}
        />

        <IndustrialZones3D reducedMotion={reducedMotion} />

        {BOARD_TILES.map((tile) => {
          const isOccupied = teams.some((t) => t.position === tile.index);
          const isActiveTile =
            (isTokenWalking ? liveWalkTileIndex : activeTeam?.position) === tile.index;
          return (
            <Tile3D
              key={tile.index}
              tile={tile}
              isOccupied={isOccupied}
              isActiveTile={isActiveTile}
              hideHtmlOverlays={hideHtmlOverlays}
              onSelectTile={onSelectTile}
            />
          );
        })}

        {teams.map((team, idx) => (
          <WorkerToken3D
            key={team.id}
            team={team}
            teamIndex={idx}
            totalTeams={teams.length}
            isActiveTurn={idx === activeTeamIndex}
            reducedMotion={reducedMotion}
            hideHtmlOverlays={hideHtmlOverlays}
            onActiveTokenProgress={idx === activeTeamIndex ? handleTokenProgress : undefined}
            onActiveTokenArrive={idx === activeTeamIndex ? onActiveTokenArrive : undefined}
          />
        ))}

        <Dice3D diceValues={diceValues} isRolling={isRolling} position={[1.5, 2.32, 5.5]} />

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
