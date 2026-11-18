import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BOARD_TILES } from '@prl-oca/shared';
import { Mascot3D } from '../scenes/Mascot3D';

interface IndustrialZones3DProps {
  reducedMotion?: boolean;
}

/**
 * Escenario industrial 3D completo que rodea e integra el recorrido de 48 casillas.
 * Incluye las 12 zonas temáticas con maquinaria animada, grúa torre, carretilla elevadora,
 * estanterías, laboratorio, subestación eléctrica y podio central de meta.
 */
export const IndustrialZones3D: React.FC<IndustrialZones3DProps> = ({
  reducedMotion = false,
}) => {
  const craneJibRef = useRef<THREE.Group>(null);
  const forkliftRef = useRef<THREE.Group>(null);
  const gearRef = useRef<THREE.Mesh>(null);

  // Path points connecting Tile 1 -> Tile 48
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
      forkliftRef.current.position.z = -4.5 + Math.sin(t * 0.9) * 2.2;
    }
    if (gearRef.current) {
      gearRef.current.rotation.z = t * 1.4;
    }
  });

  return (
    <group>
      {/* Suelo principal de hormigón industrial pulido */}
      <RoundedBox
        args={[48, 0.8, 40]}
        radius={0.35}
        smoothness={4}
        position={[0, -0.45, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#0F172A" metalness={0.3} roughness={0.75} />
      </RoundedBox>

      {/* Marco perimetral amarillo/negro de seguridad */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[21.5, 22.4, 4]} />
        <meshStandardMaterial color="#FFB800" emissive="#FFB800" emissiveIntensity={0.18} />
      </mesh>

      {/* Línea luminosa guía que conecta las 48 casillas en orden */}
      <Line
        points={pathPoints}
        color="#FFB800"
        lineWidth={3}
        dashed={false}
      />

      {/* ================= 1. FÁBRICA INDUSTRIAL (Suroeste [-16, 0, 17]) ================= */}
      <group position={[-14, 0, 17.6]}>
        <RoundedBox args={[8.5, 2.6, 2.6]} radius={0.1} position={[0, 1.3, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#1E293B" metalness={0.55} roughness={0.4} />
        </RoundedBox>
        {/* Chimeneas y silos */}
        <mesh position={[-2.6, 3.3, -0.4]} castShadow>
          <cylinderGeometry args={[0.45, 0.55, 2.2, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[-1.2, 3.3, -0.4]} castShadow>
          <cylinderGeometry args={[0.45, 0.55, 2.2, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Rueda dentada industrial animada */}
        <mesh ref={gearRef} position={[2.2, 2.2, 1.4]} castShadow>
          <torusGeometry args={[0.65, 0.18, 12, 16]} />
          <meshStandardMaterial color="#FFB800" metalness={0.7} roughness={0.25} />
        </mesh>
        <Html position={[0, 3.2, 0]} center distanceFactor={32} zIndexRange={[2, 0]}>
          <div className="zone-badge3d">ZONA 1 · FÁBRICA INDUSTRIAL</div>
        </Html>
      </group>

      {/* ================= 2. ALMACÉN LOGÍSTICO (Sureste [11, 0, 17.6]) ================= */}
      <group position={[11, 0, 17.6]}>
        {[-2.4, 0, 2.4].map((xOffset, idx) => (
          <group key={`rack_${idx}`} position={[xOffset, 0, 0]}>
            <mesh position={[0, 1.5, 0]} castShadow>
              <boxGeometry args={[1.9, 3.0, 1.2]} />
              <meshStandardMaterial color="#0284C7" metalness={0.6} roughness={0.35} />
            </mesh>
            {/* Palets y cajas en niveles */}
            <mesh position={[0, 0.7, 0.1]} castShadow>
              <boxGeometry args={[1.5, 0.65, 1.0]} />
              <meshStandardMaterial color="#D97706" roughness={0.65} />
            </mesh>
            <mesh position={[0, 1.9, 0.1]} castShadow>
              <boxGeometry args={[1.4, 0.65, 1.0]} />
              <meshStandardMaterial color="#F59E0B" roughness={0.6} />
            </mesh>
          </group>
        ))}
        <Html position={[0, 3.4, 0]} center distanceFactor={32} zIndexRange={[2, 0]}>
          <div className="zone-badge3d">ZONA 2 · ALMACÉN LOGÍSTICO</div>
        </Html>
      </group>

      {/* ================= 3. TALLER MECÁNICO (Este [21.8, 0, 2]) ================= */}
      <group position={[21.8, 0, 2]}>
        <RoundedBox args={[2.6, 2.2, 7.5]} radius={0.1} position={[0, 1.1, 0]} castShadow>
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.45} />
        </RoundedBox>
        {/* Cabina de torno y soldadura */}
        <mesh position={[-0.4, 2.5, -1.5]} castShadow>
          <boxGeometry args={[1.6, 0.9, 2.2]} />
          <meshStandardMaterial color="#EA580C" metalness={0.45} roughness={0.35} />
        </mesh>
        <Html position={[0, 3.2, 0]} center distanceFactor={32} zIndexRange={[2, 0]}>
          <div className="zone-badge3d">ZONA 3 · TALLER MECÁNICO</div>
        </Html>
      </group>

      {/* ================= 4. OFICINAS CORPORATIVAS (Noreste [13, 0, -17.5]) ================= */}
      <group position={[13, 0, -17.5]}>
        <RoundedBox args={[7.5, 3.2, 2.5]} radius={0.12} position={[0, 1.6, 0]} castShadow>
          <meshStandardMaterial
            color="#38BDF8"
            metalness={0.75}
            roughness={0.15}
            transparent
            opacity={0.82}
          />
        </RoundedBox>
        <Html position={[0, 3.6, 0]} center distanceFactor={32} zIndexRange={[2, 0]}>
          <div className="zone-badge3d">ZONA 4 · OFICINAS Y PVD</div>
        </Html>
      </group>

      {/* ================= 5. CONSTRUCCIÓN Y GRÚA TORRE (Norte [-7, 0, -17.5]) ================= */}
      <group position={[-7, 0, -17.5]}>
        {/* Mástil de la Grúa Torre */}
        <mesh position={[0, 3.6, 0]} castShadow>
          <boxGeometry args={[0.9, 7.2, 0.9]} />
          <meshStandardMaterial color="#FFB800" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Pluma giratoria de la grúa */}
        <group ref={craneJibRef} position={[0, 7.1, 0]}>
          <mesh position={[1.8, 0, 0]} castShadow>
            <boxGeometry args={[6.4, 0.55, 0.55]} />
            <meshStandardMaterial color="#FFB800" metalness={0.55} roughness={0.3} />
          </mesh>
          {/* Contrapeso */}
          <mesh position={[-1.4, -0.1, 0]} castShadow>
            <boxGeometry args={[1.1, 0.8, 0.8]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Cable y gancho */}
          <mesh position={[3.8, -1.4, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2.6, 8]} />
            <meshStandardMaterial color="#94A3B8" />
          </mesh>
        </group>
        {/* Andamio perimetral con barandilla */}
        <mesh position={[3.4, 1.4, 0.3]} castShadow>
          <boxGeometry args={[3.4, 2.8, 1.4]} />
          <meshStandardMaterial color="#64748B" metalness={0.6} roughness={0.4} />
        </mesh>
        <Html position={[0, 4.4, 0]} center distanceFactor={32} zIndexRange={[2, 0]}>
          <div className="zone-badge3d">ZONA 5 · OBRA Y TRABAJOS EN ALTURA</div>
        </Html>
      </group>

      {/* ================= 6. LABORATORIO Y 7. HOSPITAL (Oeste [-21.8, 0, -2]) ================= */}
      <group position={[-21.8, 0, -2]}>
        <RoundedBox args={[2.6, 2.6, 9.5]} radius={0.12} position={[0, 1.3, 0]} castShadow>
          <meshStandardMaterial color="#F1F5F9" metalness={0.25} roughness={0.3} />
        </RoundedBox>
        {/* Tanques de laboratorio */}
        <mesh position={[0.4, 2.9, -2.2]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 1.4, 20]} />
          <meshStandardMaterial
            color="#06B6D4"
            emissive="#0891B2"
            emissiveIntensity={0.35}
            metalness={0.4}
            roughness={0.2}
          />
        </mesh>
        {/* Cruz Verde Sanitaria 3D */}
        <group position={[0.6, 2.9, 2.4]}>
          <mesh>
            <boxGeometry args={[0.3, 1.1, 0.3]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.6} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.3, 0.3, 1.1]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.6} />
          </mesh>
        </group>
        <Html position={[0, 3.6, 0]} center distanceFactor={32} zIndexRange={[2, 0]}>
          <div className="zone-badge3d">ZONAS 6 Y 7 · LABORATORIO Y CENTRO SANITARIO</div>
        </Html>
      </group>

      {/* ================= 8. CARGA Y CARRETILLA ELEVADORA 3D ([14.5, 0.3, -4.5]) ================= */}
      <group ref={forkliftRef} position={[14.5, 0.45, -4.5]}>
        <RoundedBox args={[1.1, 0.7, 1.6]} radius={0.08} position={[0, 0.35, 0]} castShadow>
          <meshStandardMaterial color="#FFB800" metalness={0.4} roughness={0.35} />
        </RoundedBox>
        {/* Pórtico antivuelco ROPS */}
        <mesh position={[0, 0.95, -0.1]} castShadow>
          <boxGeometry args={[0.95, 0.7, 1.0]} />
          <meshStandardMaterial color="#1E293B" wireframe={false} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Mástil y horquillas bajas a 15 cm */}
        <mesh position={[0, 0.7, 0.9]} castShadow>
          <boxGeometry args={[0.7, 1.3, 0.12]} />
          <meshStandardMaterial color="#0F172A" metalness={0.8} />
        </mesh>
      </group>

      {/* ================= 11. SUBESTACIÓN ELÉCTRICA ([-8.5, 0.5, 5.2]) ================= */}
      <group position={[-8.5, 0.5, 5.2]}>
        <RoundedBox args={[2.2, 1.8, 1.6]} radius={0.06} position={[0, 0.9, 0]} castShadow>
          <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.3} />
        </RoundedBox>
        {/* Aisladores de alta tensión */}
        {[-0.6, 0, 0.6].map((x, i) => (
          <mesh key={`ins_${i}`} position={[x, 2.1, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.7, 16]} />
            <meshStandardMaterial color="#38BDF8" emissive="#0284C7" emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>

      {/* ================= 12. META CENTRAL Y MASCOTA "PREVENITO" ([0, 1.65, 0]) ================= */}
      <group position={[0, 0.2, 0]}>
        {/* Podio escalonado central */}
        <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[3.4, 4.2, 0.8, 32]} />
          <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.95, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[2.5, 3.1, 0.45, 32]} />
          <meshStandardMaterial
            color="#0F172A"
            emissive="#FFB800"
            emissiveIntensity={0.22}
            metalness={0.6}
            roughness={0.25}
          />
        </mesh>
        {/* Mascota 3D "Prevenito" junto a la Meta */}
        <Mascot3D position={[1.9, 1.15, -1.4]} scale={0.78} mood="happy" />
      </group>
    </group>
  );
};
