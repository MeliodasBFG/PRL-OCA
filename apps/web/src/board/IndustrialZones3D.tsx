import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BOARD_TILES } from '@prl-oca/shared';
import { Mascot3D } from '../scenes/Mascot3D';
import {
  BIEFireCabinet3D,
  CircularSawBench3D,
  ElectricalPanel3D,
  FireExtinguisher3D,
  FirstAidKit3D,
  ForkliftDetailed3D,
  GasCylinder3D,
  Gear3D,
  LabFlask3D,
  OfficeWorkstation3D,
  PalletRack3D,
  SafetySign3D,
} from '../models/PRLModels3D';

interface IndustrialZones3DProps {
  reducedMotion?: boolean;
}

function createZoneSignTexture(label: string, accentColor = '#FFB800'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = accentColor;
    ctx.font = '900 30px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 50);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const ZoneSignboard3D: React.FC<{
  label: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  accent?: string;
}> = ({ label, position, rotation = [0, 0, 0], accent = '#FFB800' }) => {
  const tex = useMemo(() => createZoneSignTexture(label, accent), [label, accent]);
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[4.4, 0.78, 0.14]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[4.25, 0.68]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  );
};

/**
 * Escenario industrial 3D completo con modelos detallados y reconocibles para las 12 zonas:
 * Fábrica, Almacén con estanterías, Taller con sierra/botellas, Oficinas con PCs y sillas,
 * Obra con grúa/andamio, Laboratorio con matraces, Hospital con botiquín/camilla, Cocina con extintores/BIE,
 * Muelle con camión/carretilla, Sala de Control, Subestación Eléctrica y Podio de Meta.
 */
export const IndustrialZones3D: React.FC<IndustrialZones3DProps> = ({
  reducedMotion = false,
}) => {
  const craneJibRef = useRef<THREE.Group>(null);
  const forkliftRef = useRef<THREE.Group>(null);
  const gearGroupRef = useRef<THREE.Group>(null);

  const pathPoints = useMemo(() => {
    return BOARD_TILES.map(
      (t) => new THREE.Vector3(t.position[0], t.position[1] + 0.08, t.position[2])
    );
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    if (craneJibRef.current) {
      craneJibRef.current.rotation.y = Math.sin(t * 0.35) * 0.65;
    }
    if (forkliftRef.current) {
      forkliftRef.current.position.z = -4.5 + Math.sin(t * 0.85) * 2.1;
    }
    if (gearGroupRef.current) {
      gearGroupRef.current.rotation.z = t * 1.4;
    }
  });

  return (
    <group>
      {/* Suelo principal de hormigón industrial claro para máximo contraste y visibilidad */}
      <RoundedBox
        args={[48, 0.8, 40]}
        radius={0.35}
        smoothness={4}
        position={[0, -0.45, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#1E293B" metalness={0.22} roughness={0.75} />
      </RoundedBox>

      {/* Marco perimetral amarillo/negro de seguridad */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[21.5, 22.4, 4]} />
        <meshStandardMaterial color="#FFB800" emissive="#FFB800" emissiveIntensity={0.2} />
      </mesh>

      {/* Línea luminosa guía que conecta las 48 casillas en orden */}
      <Line points={pathPoints} color="#FFB800" lineWidth={3} dashed={false} />

      {/* ================= 1. FÁBRICA INDUSTRIAL (Suroeste [-14, 0, 17.6]) ================= */}
      <group position={[-14, 0, 17.6]}>
        <RoundedBox args={[8.5, 2.5, 2.5]} radius={0.1} position={[0, 1.25, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.45} />
        </RoundedBox>
        {/* Techo en diente de sierra */}
        {[-2.8, 0, 2.8].map((x, i) => (
          <mesh key={i} position={[x, 2.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[1.4, 1.1, 4]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        ))}
        {/* Chimeneas industriales */}
        <mesh position={[-2.6, 3.6, -0.4]} castShadow>
          <cylinderGeometry args={[0.38, 0.48, 2.4, 16]} />
          <meshStandardMaterial color="#64748B" metalness={0.5} />
        </mesh>
        <mesh position={[-1.3, 3.6, -0.4]} castShadow>
          <cylinderGeometry args={[0.38, 0.48, 2.4, 16]} />
          <meshStandardMaterial color="#64748B" metalness={0.5} />
        </mesh>
        {/* Engranaje animado y cinta transportadora delantera */}
        <group ref={gearGroupRef} position={[2.2, 1.8, 1.4]}>
          <Gear3D color="#FFB800" scale={2.1} />
        </group>
        <ZoneSignboard3D
          label="1 · FÁBRICA INDUSTRIAL"
          position={[0, 3.8, -0.8]}
          rotation={[0, Math.PI, 0]}
          accent="#10B981"
        />
      </group>

      {/* ================= 2. ALMACÉN LOGÍSTICO (Sureste [11, 0, 17.6]) ================= */}
      <group position={[11, 0, 17.6]}>
        <PalletRack3D position={[-2.4, 0, 0]} scale={1.35} />
        <PalletRack3D position={[0.5, 0, 0]} scale={1.35} />
        <PalletRack3D position={[3.4, 0, 0]} scale={1.35} />
        <ZoneSignboard3D
          label="2 · ALMACÉN LOGÍSTICO"
          position={[0.5, 3.6, 0]}
          rotation={[0, Math.PI, 0]}
          accent="#38BDF8"
        />
      </group>

      {/* ================= 3. TALLER MECÁNICO (Este [21.8, 0, 2]) ================= */}
      <group position={[21.8, 0, 2]} rotation={[0, -Math.PI / 2, 0]}>
        <CircularSawBench3D guarded={true} position={[-2.0, 0, 0]} scale={1.35} />
        <GasCylinder3D chained={true} position={[0.4, 0, -0.3]} scale={1.45} />
        <GasCylinder3D chained={true} position={[1.1, 0, -0.3]} scale={1.45} />
        <FireExtinguisher3D variant="abc" position={[2.4, 0, 0]} scale={1.55} />
        <ZoneSignboard3D label="3 · TALLER MECÁNICO" position={[0, 2.9, -1.0]} accent="#FB923C" />
      </group>

      {/* ================= 4. OFICINAS CORPORATIVAS (Noreste [13, 0, -17.5]) ================= */}
      <group position={[13, 0, -17.5]}>
        <RoundedBox args={[7.8, 3.0, 2.8]} radius={0.12} position={[0, 1.5, -0.4]} castShadow>
          <meshStandardMaterial color="#1E3A5F" metalness={0.5} roughness={0.25} transparent opacity={0.45} />
        </RoundedBox>
        <OfficeWorkstation3D ergonomic={true} position={[-1.8, 0, 0]} scale={1.15} />
        <OfficeWorkstation3D ergonomic={true} position={[1.8, 0, 0]} scale={1.15} />
        <ZoneSignboard3D label="4 · OFICINAS Y PVD" position={[0, 3.55, 0.8]} accent="#38BDF8" />
      </group>

      {/* ================= 5. CONSTRUCCIÓN Y GRÚA TORRE (Norte [-7, 0, -17.5]) ================= */}
      <group position={[-7, 0, -17.5]}>
        {/* Mástil de la Grúa Torre */}
        <mesh position={[0, 3.6, 0]} castShadow>
          <boxGeometry args={[0.9, 7.2, 0.9]} />
          <meshStandardMaterial color="#FFB800" metalness={0.45} roughness={0.35} />
        </mesh>
        <group ref={craneJibRef} position={[0, 7.1, 0]}>
          <mesh position={[1.8, 0, 0]} castShadow>
            <boxGeometry args={[6.4, 0.55, 0.55]} />
            <meshStandardMaterial color="#FFB800" metalness={0.55} roughness={0.3} />
          </mesh>
          <mesh position={[-1.4, -0.1, 0]} castShadow>
            <boxGeometry args={[1.1, 0.8, 0.8]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[3.8, -1.4, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.6, 8]} />
            <meshStandardMaterial color="#CBD5E1" />
          </mesh>
        </group>
        {/* Andamio tubular real con plataformas y barandillas amarillas */}
        <group position={[3.6, 0, 0.3]}>
          {[-1.5, 1.5].map((x) =>
            [-0.5, 0.5].map((z) => (
              <mesh key={`${x}_${z}`} position={[x, 1.5, z]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 3.0, 8]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.7} />
              </mesh>
            ))
          )}
          <mesh position={[0, 1.3, 0]} castShadow>
            <boxGeometry args={[3.2, 0.1, 1.1]} />
            <meshStandardMaterial color="#D97706" />
          </mesh>
          <mesh position={[0, 2.2, 0.52]}>
            <boxGeometry args={[3.2, 0.08, 0.08]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
        </group>
        <ZoneSignboard3D label="5 · OBRA Y ALTURA" position={[2.4, 3.4, 0.8]} accent="#FFB800" />
      </group>

      {/* ================= 6. LABORATORIO Y 7. HOSPITAL (Oeste [-21.8, 0, -2]) ================= */}
      <group position={[-21.8, 0, -2]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[8.5, 2.4, 2.4]} radius={0.12} position={[0, 1.2, -0.6]} castShadow>
          <meshStandardMaterial color="#E2E8F0" metalness={0.2} roughness={0.35} />
        </RoundedBox>
        <LabFlask3D position={[-2.6, 2.45, -0.3]} scale={2.1} />
        <LabFlask3D position={[-1.7, 2.45, -0.3]} scale={1.7} />
        <FirstAidKit3D position={[2.2, 2.75, 0]} scale={1.8} />
        <ZoneSignboard3D label="6-7 · LAB Y HOSPITAL" position={[0, 3.3, 0.5]} accent="#10B981" />
      </group>

      {/* ================= 8. CARGA Y CARRETILLA ELEVADORA 3D ([14.5, 0.3, -4.5]) ================= */}
      <group ref={forkliftRef} position={[14.5, 0.35, -4.5]}>
        <ForkliftDetailed3D forksHigh={false} scale={1.15} />
      </group>

      {/* ================= 9. COCINA E INCENDIOS ([4.5, 0.7, 11.4]) ================= */}
      <group position={[4.5, 0.75, 11.2]}>
        <FireExtinguisher3D variant="co2" position={[-0.6, 0, 0]} scale={1.15} />
        <BIEFireCabinet3D position={[0.6, 0, 0]} scale={0.95} />
      </group>

      {/* ================= 11. SUBESTACIÓN ELÉCTRICA ([-8.5, 0.5, 5.2]) ================= */}
      <group position={[-8.5, 0.5, 5.2]}>
        <ElectricalPanel3D withPadlock={true} position={[0, 0, 0]} scale={1.05} />
        <SafetySign3D kind="warning" position={[0, 2.1, 0]} scale={0.85} />
      </group>

      {/* ================= 12. META CENTRAL Y MASCOTA "PREVENITO" ([0, 0.2, 0]) ================= */}
      <group position={[0, 0.2, 0]}>
        <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[3.4, 4.2, 0.8, 32]} />
          <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.95, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[2.5, 3.1, 0.45, 32]} />
          <meshStandardMaterial
            color="#1E293B"
            emissive="#FFB800"
            emissiveIntensity={0.22}
            metalness={0.55}
            roughness={0.25}
          />
        </mesh>
        <Mascot3D position={[1.9, 1.15, -1.4]} scale={0.85} mood="happy" />
      </group>
    </group>
  );
};
