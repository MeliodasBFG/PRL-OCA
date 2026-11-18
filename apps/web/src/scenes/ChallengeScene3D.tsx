import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Challenge3DDefinition, ChallengeHotspot3D } from '@prl-oca/shared';

interface ChallengeScene3DProps {
  challenge: Challenge3DDefinition;
  selectedIds: string[];
  revealed: boolean;
  onToggleHotspot: (id: string) => void;
}

const HotspotMarker3D: React.FC<{
  hotspot: ChallengeHotspot3D;
  index: number;
  isSelected: boolean;
  revealed: boolean;
  onToggle: () => void;
}> = ({ hotspot, index, isSelected, revealed, onToggle }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const s = isSelected ? 1.25 : 1 + Math.sin(clock.getElapsedTime() * 4 + index) * 0.1;
      meshRef.current.scale.set(s, s, s);
      meshRef.current.rotation.y = clock.getElapsedTime() * 1.5;
    }
  });

  const color = revealed
    ? hotspot.isCorrect
      ? '#10B981'
      : '#EF4444'
    : isSelected
    ? '#FFB800'
    : '#38BDF8';

  return (
    <group
      position={hotspot.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Objeto 3D interactivo en la posición del hotspot */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        castShadow
      >
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected || revealed ? 0.85 : 0.4}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>

      {/* Pedestal de referencia hacia el suelo */}
      <mesh position={[0, -hotspot.position[1] / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.14, hotspot.position[1], 12]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Marcador numérico compacto (#1..#5) que no tapa el escenario 3D */}
      <Html position={[0, 0.52, 0]} center zIndexRange={[10, 0]}>
        <button
          type="button"
          onClick={onToggle}
          title={hotspot.label}
          className={`hotspot-3d-badge ${isSelected ? 'selected' : ''} ${
            revealed ? (hotspot.isCorrect ? 'correct' : 'wrong') : ''
          }`}
        >
          <span>{index + 1}</span>
          {hovered && <em className="hotspot-hover-text">{hotspot.label}</em>}
        </button>
      </Html>
    </group>
  );
};

export const ChallengeScene3D: React.FC<ChallengeScene3DProps> = ({
  challenge,
  selectedIds,
  revealed,
  onToggleHotspot,
}) => {
  return (
    <div className="challenge-3d-viewport">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.6, 5.8], fov: 45 }}>
        <color attach="background" args={['#0B1322']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[6, 10, 6]} intensity={1.35} castShadow />
        <pointLight position={[0, 3, 2]} intensity={0.9} color="#FFB800" />

        {/* Suelo y paredes del escenario 3D del desafío */}
        <RoundedBox args={[7.6, 0.3, 5.2]} radius={0.08} position={[0, -0.15, 0]} receiveShadow>
          <meshStandardMaterial color="#1E293B" metalness={0.4} roughness={0.65} />
        </RoundedBox>
        <RoundedBox args={[7.6, 3.0, 0.25]} radius={0.05} position={[0, 1.5, -2.5]} receiveShadow>
          <meshStandardMaterial color="#0F172A" metalness={0.5} roughness={0.5} />
        </RoundedBox>

        {/* Mobiliario / Maquinaria contextual del escenario 3D */}
        <RoundedBox args={[1.8, 1.0, 1.1]} radius={0.06} position={[-2.2, 0.5, -0.8]} castShadow>
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.35} />
        </RoundedBox>
        <RoundedBox args={[1.6, 1.4, 1.0]} radius={0.06} position={[0, 0.7, -1.1]} castShadow>
          <meshStandardMaterial color="#0284C7" metalness={0.45} roughness={0.4} />
        </RoundedBox>
        <RoundedBox args={[1.6, 1.8, 1.0]} radius={0.06} position={[2.2, 0.9, -0.8]} castShadow>
          <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.35} />
        </RoundedBox>

        {/* Hotspots 3D interactivos */}
        {challenge.hotspots.map((h, idx) => (
          <HotspotMarker3D
            key={h.id}
            hotspot={h}
            index={idx}
            isSelected={selectedIds.includes(h.id)}
            revealed={revealed}
            onToggle={() => onToggleHotspot(h.id)}
          />
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={3.5}
          maxDistance={9.5}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>
    </div>
  );
};
