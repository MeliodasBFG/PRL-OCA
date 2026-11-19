import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Challenge3DDefinition, ChallengeHotspot3D } from '@prl-oca/shared';
import {
  BIEFireCabinet3D,
  CircularSawBench3D,
  ElectricalPanel3D,
  FireExtinguisher3D,
  Flames3D,
  ForkliftDetailed3D,
  GasCylinder3D,
  OfficeWorkstation3D,
  OilSpill3D,
  PalletRack3D,
  SafetyBoots3D,
  SafetyHarness3D,
  SafetyHelmet3D,
  SafetySign3D,
  Sneakers3D,
  WaistBelt3D,
} from '../models/PRLModels3D';

interface ChallengeScene3DProps {
  challenge: Challenge3DDefinition;
  selectedIds: string[];
  revealed: boolean;
  onToggleHotspot: (id: string) => void;
}

/**
 * Renders the exact physical 3D object for each hotspot ID across all 8 challenges,
 * with every single prop, sign, rack, and mannequin firmly grounded on the floor (world y = 0)
 * or mounted onto a physical stand/post/wall.
 */
const HotspotPhysicalProp3D: React.FC<{ id: string }> = ({ id }) => {
  switch (id) {
    // -------- DESAFÍO 1: TALLER MECÁNICO --------
    case 'c1_h1': // Sierra circular sin resguardo (y=1.1 -> -1.1)
      return <CircularSawBench3D guarded={false} scale={0.95} position={[0, -1.1, 0]} />;
    case 'c1_h2': // Charco de aceite (y=0.15 -> -0.15)
      return <OilSpill3D scale={1.15} position={[0, -0.15, 0]} />;
    case 'c1_h3': // Botella de gas sin encadenar (y=1.3 -> -1.3)
      return <GasCylinder3D chained={false} scale={1.05} position={[0, -1.3, 0]} />;
    case 'c1_h4': // Extintor mural señalizado sobre soporte vertical (y=1.4 -> -1.4)
      return (
        <group position={[0, -1.4, 0]}>
          {/* Soporte vertical metálico con base al suelo */}
          <RoundedBox args={[0.85, 0.08, 0.55]} radius={0.02} position={[0, 0.04, 0]} receiveShadow>
            <meshStandardMaterial color="#1E293B" />
          </RoundedBox>
          <RoundedBox args={[0.78, 1.85, 0.1]} radius={0.02} position={[0, 0.96, -0.2]} castShadow>
            <meshStandardMaterial color="#475569" metalness={0.5} />
          </RoundedBox>
          <FireExtinguisher3D variant="abc" scale={1.1} position={[0, 0.08, 0.05]} />
          <SafetySign3D kind="fire" position={[0, 1.48, -0.12]} scale={0.75} />
        </group>
      );
    case 'c1_h5': // Banco protegido con resguardo (y=1.2 -> -1.2)
      return <CircularSawBench3D guarded={true} scale={0.95} position={[0, -1.2, 0]} />;

    // -------- DESAFÍO 2: EQUÍPATE EPI EN ALTURA --------
    case 'c2_h1': // Casco con barbuquejo sobre expositor de pie (y=1.6 -> -1.6)
      return (
        <group position={[0, -1.6, 0]}>
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[0.32, 0.36, 0.08, 20]} />
            <meshStandardMaterial color="#1E293B" metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 1.32, 12]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.75} />
          </mesh>
          <SafetyHelmet3D color="#FFB800" withChinStrap={true} scale={1.35} position={[0, 1.4, 0]} />
        </group>
      );
    case 'c2_h2': // Arnés anticaídas EN 361 sobre maniquí con pie (y=1.4 -> -1.4)
      return (
        <group position={[0, -1.4, 0]}>
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[0.36, 0.4, 0.08, 20]} />
            <meshStandardMaterial color="#1E293B" metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 1.0, 12]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.75} />
          </mesh>
          <SafetyHarness3D scale={1.3} position={[0, 0.92, 0]} />
        </group>
      );
    case 'c2_h3': // Botas S3 sobre peana expositora (y=0.7 -> -0.7)
      return (
        <group position={[0, -0.7, 0]}>
          <RoundedBox args={[0.92, 0.4, 0.65]} radius={0.04} position={[0, 0.2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#334155" metalness={0.4} />
          </RoundedBox>
          <SafetyBoots3D scale={1.35} position={[0, 0.4, 0]} />
        </group>
      );
    case 'c2_h4': // Cinturón lumbar simple sobre peana (y=0.5 -> -0.5)
      return (
        <group position={[0, -0.5, 0]}>
          <RoundedBox args={[0.8, 0.35, 0.62]} radius={0.04} position={[0, 0.175, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#334155" metalness={0.4} />
          </RoundedBox>
          <WaistBelt3D scale={1.35} position={[0, 0.35, 0]} />
        </group>
      );
    case 'c2_h5': // Zapatilla deportiva sobre peana (y=0.5 -> -0.5)
      return (
        <group position={[0, -0.5, 0]}>
          <RoundedBox args={[0.85, 0.35, 0.62]} radius={0.04} position={[0, 0.175, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#334155" metalness={0.4} />
          </RoundedBox>
          <Sneakers3D scale={1.35} position={[0, 0.35, 0]} />
        </group>
      );

    // -------- DESAFÍO 3: EVACUACIÓN DEL EDIFICIO --------
    case 'c3_h1': // Escalera protegida + señal verde salida con poste (y=1.0 -> -1.0)
      return (
        <group position={[0, -1.0, 0]}>
          {[0, 1, 2, 3].map((step) => (
            <RoundedBox
              key={step}
              args={[1.1, 0.2, 0.32]}
              radius={0.02}
              position={[0, step * 0.2 + 0.1, 0.35 - step * 0.26]}
              castShadow
            >
              <meshStandardMaterial color="#94A3B8" />
            </RoundedBox>
          ))}
          <SafetySign3D
            kind="exit"
            withPost={true}
            postHeight={0.65}
            position={[0, 1.42, -0.42]}
            scale={0.85}
          />
        </group>
      );
    case 'c3_h2': // Puerta cortafuegos RF cerrada con marco al suelo (y=1.1 -> -1.1)
      return (
        <group position={[0, -1.1, 0]}>
          <RoundedBox args={[1.1, 1.72, 0.18]} radius={0.03} position={[0, 0.86, -0.02]} castShadow>
            <meshStandardMaterial color="#334155" />
          </RoundedBox>
          <RoundedBox args={[0.92, 1.62, 0.12]} radius={0.02} position={[0, 0.82, 0.04]} castShadow>
            <meshStandardMaterial color="#DC2626" metalness={0.35} roughness={0.35} />
          </RoundedBox>
          <mesh position={[0, 0.82, 0.12]}>
            <boxGeometry args={[0.68, 0.08, 0.06]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.35} />
          </mesh>
        </group>
      );
    case 'c3_h3': // Punto de encuentro exterior al suelo (y=0.6 -> -0.6)
      return (
        <group position={[0, -0.6, 0]}>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[0.85, 24]} />
            <meshStandardMaterial color="#10B981" emissive="#059669" emissiveIntensity={0.35} />
          </mesh>
          <SafetySign3D
            kind="assembly"
            withPost={true}
            postHeight={1.25}
            position={[0, 1.25, 0]}
            scale={0.85}
          />
        </group>
      );
    case 'c3_h4': // Ascensor prohibido en incendio al suelo (y=1.4 -> -1.4)
      return (
        <group position={[0, -1.4, 0]}>
          <RoundedBox args={[1.15, 1.75, 0.2]} radius={0.04} position={[0, 0.875, 0]} castShadow>
            <meshStandardMaterial color="#94A3B8" metalness={0.7} roughness={0.25} />
          </RoundedBox>
          <mesh position={[0, 0.88, 0.11]}>
            <boxGeometry args={[0.04, 1.6, 0.02]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
          <SafetySign3D kind="prohibition" position={[0, 1.15, 0.14]} scale={0.75} />
        </group>
      );
    case 'c3_h5': // Vestuario con mochila al suelo (y=1.2 -> -1.2)
      return (
        <group position={[0, -1.2, 0]}>
          <RoundedBox args={[0.9, 1.55, 0.55]} radius={0.04} position={[0, 0.775, 0]} castShadow>
            <meshStandardMaterial color="#64748B" metalness={0.5} roughness={0.4} />
          </RoundedBox>
          <RoundedBox args={[0.38, 0.48, 0.24]} radius={0.08} position={[0.15, 0.24, 0.38]} castShadow>
            <meshStandardMaterial color="#EA580C" />
          </RoundedBox>
        </group>
      );

    // -------- DESAFÍO 4: EXTINCIÓN DE INCENDIOS --------
    case 'c4_h1': // Cuadro corte general + pulsador alarma sobre pedestal al suelo (y=1.3 -> -1.3)
      return (
        <group position={[0, -1.3, 0]}>
          <RoundedBox args={[0.85, 1.45, 0.36]} radius={0.04} position={[0, 0.725, 0]} castShadow>
            <meshStandardMaterial color="#475569" metalness={0.55} />
          </RoundedBox>
          <RoundedBox args={[0.26, 0.26, 0.1]} radius={0.02} position={[0.52, 0.95, 0.05]} castShadow>
            <meshStandardMaterial color="#EF4444" emissive="#DC2626" emissiveIntensity={0.4} />
          </RoundedBox>
          <mesh position={[0.36, 0.95, 0.04]}>
            <boxGeometry args={[0.14, 0.08, 0.08]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-0.1, 0.95, 0.22]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.14, 0.08, 0.18]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
        </group>
      );
    case 'c4_h2': // Extintor CO2 apoyado en bandeja sobre el suelo (y=1.1 -> -1.1)
      return (
        <group position={[0, -1.1, 0]}>
          <mesh position={[0, 0.03, 0]} receiveShadow>
            <cylinderGeometry args={[0.35, 0.38, 0.06, 20]} />
            <meshStandardMaterial color="#991B1B" />
          </mesh>
          <FireExtinguisher3D variant="co2" scale={1.3} position={[0, 0.05, 0]} />
        </group>
      );
    case 'c4_h3': // Fuego en equipo + señal de salida en poste al suelo (y=0.9 -> -0.9)
      return (
        <group position={[0, -0.9, 0]}>
          <RoundedBox args={[0.85, 0.28, 0.75]} radius={0.03} position={[0, 0.14, 0]} castShadow>
            <meshStandardMaterial color="#334155" />
          </RoundedBox>
          <Flames3D scale={1.2} position={[0, 0.26, 0]} />
          <SafetySign3D
            kind="exit"
            withPost={true}
            postHeight={1.2}
            position={[0.65, 1.2, -0.35]}
            scale={0.75}
          />
        </group>
      );
    case 'c4_h4': // Cubo de agua apoyado en el suelo (y=0.6 -> -0.6)
      return (
        <group position={[0, -0.6, 0]}>
          <mesh position={[0, 0.26, 0]} castShadow>
            <cylinderGeometry args={[0.32, 0.22, 0.52, 20]} />
            <meshStandardMaterial color="#0284C7" metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.48, 0]}>
            <cylinderGeometry args={[0.29, 0.29, 0.04, 20]} />
            <meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={0.35} />
          </mesh>
        </group>
      );
    case 'c4_h5': // Rincón cerrado sin salida al suelo (y=0.8 -> -0.8)
      return (
        <group position={[0, -0.8, 0]}>
          <RoundedBox args={[1.05, 1.35, 0.25]} radius={0.03} position={[0, 0.675, -0.2]} castShadow>
            <meshStandardMaterial color="#991B1B" roughness={0.8} />
          </RoundedBox>
          <Flames3D scale={0.95} position={[0, 0, 0.22]} />
        </group>
      );

    // -------- DESAFÍO 5: ORDEN EN EL ALMACÉN --------
    case 'c5_h1': // Estantería completa al suelo con carga pesada sobresaliendo en nivel superior (y=2.1 -> -2.1)
      return <PalletRack3D overhangingTop={true} position={[0, -2.1, 0]} scale={0.95} />;
    case 'c5_h2': // Puntal metálico doblado con placa de anclaje al suelo (y=0.8 -> -0.8)
      return (
        <group position={[0, -0.8, 0]}>
          <mesh position={[0, 0.03, 0]} receiveShadow>
            <boxGeometry args={[0.45, 0.06, 0.45]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[-0.08, 0.45, 0]} rotation={[0, 0, -0.22]} castShadow>
            <boxGeometry args={[0.14, 0.85, 0.14]} />
            <meshStandardMaterial color="#EF4444" emissive="#DC2626" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0.08, 1.22, 0]} rotation={[0, 0, 0.22]} castShadow>
            <boxGeometry args={[0.14, 0.82, 0.14]} />
            <meshStandardMaterial color="#0284C7" metalness={0.5} />
          </mesh>
        </group>
      );
    case 'c5_h3': // Muro con BIE y Salida + Cajas obstaculizando en el suelo (y=0.9 -> -0.9)
      return (
        <group position={[0, -0.9, 0]}>
          <RoundedBox args={[1.75, 1.85, 0.16]} radius={0.03} position={[0.05, 0.925, -0.42]} castShadow>
            <meshStandardMaterial color="#334155" />
          </RoundedBox>
          <BIEFireCabinet3D position={[-0.35, 0.52, -0.22]} scale={0.85} />
          <SafetySign3D kind="exit" position={[0.48, 1.32, -0.3]} scale={0.72} />
          <RoundedBox args={[0.62, 0.52, 0.52]} radius={0.03} position={[0, 0.26, 0.2]} castShadow>
            <meshStandardMaterial color="#D97706" roughness={0.7} />
          </RoundedBox>
          <RoundedBox args={[0.52, 0.44, 0.48]} radius={0.03} position={[0.16, 0.72, 0.14]} castShadow>
            <meshStandardMaterial color="#F59E0B" roughness={0.7} />
          </RoundedBox>
        </group>
      );
    case 'c5_h4': // Placa de carga máxima sobre poste metálico al suelo (y=1.5 -> -1.5)
      return (
        <SafetySign3D
          kind="load_plate"
          withPost={true}
          postHeight={1.5}
          scale={1.0}
          position={[0, 0, 0]}
        />
      );
    case 'c5_h5': // Paso peatonal amarillo al ras del suelo con barandilla apoyada (y=0.3 -> -0.3)
      return (
        <group position={[0, -0.3, 0]}>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[1.45, 0.75]} />
            <meshStandardMaterial color="#10B981" />
          </mesh>
          <mesh position={[-0.65, 0.35, -0.3]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 10]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
          <mesh position={[0.65, 0.35, -0.3]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 10]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
          <mesh position={[0, 0.66, -0.3]} castShadow>
            <boxGeometry args={[1.38, 0.08, 0.06]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
        </group>
      );

    // -------- DESAFÍO 6: RIESGO ELÉCTRICO (5 REGLAS DE ORO) --------
    case 'c6_h1': // Seccionador sin candado LOTO sobre columna metálica al suelo (y=1.5 -> -1.5)
      return (
        <group position={[0, -1.5, 0]}>
          <RoundedBox args={[0.68, 1.65, 0.34]} radius={0.04} position={[0, 0.825, 0]} castShadow>
            <meshStandardMaterial color="#475569" metalness={0.5} />
          </RoundedBox>
          <mesh position={[0, 1.35, 0.2]} rotation={[0.45, 0, 0]}>
            <boxGeometry args={[0.16, 0.08, 0.24]} />
            <meshStandardMaterial color="#EF4444" emissive="#DC2626" emissiveIntensity={0.4} />
          </mesh>
        </group>
      );
    case 'c6_h2': // Embarrado cobre desnudo dentro de bastidor al suelo (y=1.3 -> -1.3)
      return (
        <group position={[0, -1.3, 0]}>
          <RoundedBox args={[0.95, 1.45, 0.28]} radius={0.03} position={[0, 0.725, -0.1]} castShadow>
            <meshStandardMaterial color="#1E293B" />
          </RoundedBox>
          {[-0.24, 0, 0.24].map((x, i) => (
            <mesh key={i} position={[x, 0.85, 0.08]} castShadow>
              <boxGeometry args={[0.1, 1.0, 0.07]} />
              <meshStandardMaterial
                color="#EA580C"
                emissive="#F97316"
                emissiveIntensity={0.5}
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>
      );
    case 'c6_h3': // Tierra desconectada en pedestal al suelo (y=0.9 -> -0.9)
      return (
        <group position={[0, -0.9, 0]}>
          <RoundedBox args={[0.65, 1.15, 0.3]} radius={0.03} position={[0, 0.575, 0]} castShadow>
            <meshStandardMaterial color="#334155" />
          </RoundedBox>
          <mesh position={[0.1, 0.32, 0.18]} rotation={[0, 0, 0.55]}>
            <cylinderGeometry args={[0.035, 0.035, 0.55, 10]} />
            <meshStandardMaterial color="#FACC15" emissive="#10B981" emissiveIntensity={0.35} />
          </mesh>
        </group>
      );
    case 'c6_h4': // Alfombra aislante dieléctrica al ras del suelo (y=0.15 -> -0.15)
      return (
        <group position={[0, -0.15, 0]}>
          <RoundedBox args={[1.65, 0.05, 0.95]} radius={0.02} position={[0, 0.025, 0]} receiveShadow>
            <meshStandardMaterial color="#0F172A" roughness={0.85} />
          </RoundedBox>
          <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.38, 0.45, 24]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
        </group>
      );
    case 'c6_h5': // Señal triangular riesgo eléctrico con poste al suelo (y=1.8 -> -1.8)
      return (
        <SafetySign3D
          kind="warning"
          withPost={true}
          postHeight={1.8}
          scale={1.0}
          position={[0, 0, 0]}
        />
      );

    // -------- DESAFÍO 7: ERGONOMÍA PVD --------
    case 'c7_h1': // Monitor bajo y mal orientado sobre mesa al suelo (y=1.4 -> -1.4)
      return (
        <group position={[0, -1.4, 0]} rotation={[0, -0.25, 0]}>
          <RoundedBox args={[1.3, 0.08, 0.72]} radius={0.02} position={[0, 0.72, 0]} castShadow>
            <meshStandardMaterial color="#B45309" />
          </RoundedBox>
          {[-0.55, 0.55].map((x) => (
            <mesh key={x} position={[x, 0.36, 0]} castShadow>
              <boxGeometry args={[0.08, 0.72, 0.58]} />
              <meshStandardMaterial color="#64748B" />
            </mesh>
          ))}
          <RoundedBox args={[1.0, 0.58, 0.06]} radius={0.02} position={[0, 1.08, 0]} castShadow>
            <meshStandardMaterial color="#0F172A" />
          </RoundedBox>
          <mesh position={[0, 1.08, 0.035]}>
            <planeGeometry args={[0.92, 0.5]} />
            <meshStandardMaterial color="#38BDF8" emissive="#0284C7" emissiveIntensity={0.5} />
          </mesh>
        </group>
      );
    case 'c7_h2': // Silla ergonómica de 5 ruedas en el suelo (y=0.9 -> -0.9)
      return (
        <group position={[0, -0.9, 0]}>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.06, 5]} />
            <meshStandardMaterial color="#1E293B" />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.42, 12]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.8} />
          </mesh>
          <RoundedBox args={[0.56, 0.09, 0.52]} radius={0.03} position={[0, 0.52, 0]} castShadow>
            <meshStandardMaterial color="#0284C7" />
          </RoundedBox>
          <RoundedBox args={[0.5, 0.62, 0.09]} radius={0.04} position={[0, 0.88, 0.22]} castShadow>
            <meshStandardMaterial color="#0284C7" />
          </RoundedBox>
        </group>
      );
    case 'c7_h3': // Mesa perpendicular con patas al suelo y reposamuñecas verde (y=1.1 -> -1.1)
      return (
        <group position={[0, -1.1, 0]}>
          <RoundedBox args={[1.25, 0.08, 0.78]} radius={0.02} position={[0, 0.75, 0]} castShadow>
            <meshStandardMaterial color="#D97706" />
          </RoundedBox>
          {[-0.55, 0.55].map((x) =>
            [-0.3, 0.3].map((z) => (
              <mesh key={`${x}_${z}`} position={[x, 0.37, z]} castShadow>
                <boxGeometry args={[0.07, 0.74, 0.07]} />
                <meshStandardMaterial color="#94A3B8" />
              </mesh>
            ))
          )}
          <RoundedBox args={[0.5, 0.04, 0.18]} radius={0.01} position={[0, 0.81, 0.05]}>
            <meshStandardMaterial color="#10B981" />
          </RoundedBox>
        </group>
      );
    case 'c7_h4': // Ventana con deslumbramiento en muro de oficina al suelo (y=1.7 -> -1.7)
      return (
        <group position={[0, -1.7, 0]}>
          <RoundedBox args={[1.35, 2.1, 0.16]} radius={0.03} position={[0, 1.05, -0.05]} castShadow>
            <meshStandardMaterial color="#475569" />
          </RoundedBox>
          <RoundedBox args={[1.1, 0.9, 0.1]} radius={0.02} position={[0, 1.45, 0.02]}>
            <meshStandardMaterial color="#FEF08A" emissive="#FDE047" emissiveIntensity={0.7} />
          </RoundedBox>
        </group>
      );
    case 'c7_h5': // Mesa con teclado en el borde apoyada en patas al suelo (y=0.7 -> -0.7)
      return (
        <group position={[0, -0.7, 0]}>
          <RoundedBox args={[0.92, 0.06, 0.55]} radius={0.02} position={[0, 0.55, 0]} castShadow>
            <meshStandardMaterial color="#92400E" />
          </RoundedBox>
          {[-0.38, 0.38].map((x) => (
            <mesh key={x} position={[x, 0.275, 0]} castShadow>
              <boxGeometry args={[0.07, 0.55, 0.44]} />
              <meshStandardMaterial color="#64748B" />
            </mesh>
          ))}
          <RoundedBox args={[0.56, 0.04, 0.18]} radius={0.01} position={[0, 0.6, 0.2]}>
            <meshStandardMaterial color="#EF4444" />
          </RoundedBox>
        </group>
      );

    // -------- DESAFÍO 8: INVESTIGACIÓN ACCIDENTE MUELLE --------
    case 'c8_h1': // Trasera de camión sin calzos + poste con semáforo ámbar al suelo (y=0.7 -> -0.7)
      return (
        <group position={[0, -0.7, 0]}>
          <RoundedBox args={[1.35, 1.15, 0.9]} radius={0.05} position={[0, 0.8, -0.15]} castShadow>
            <meshStandardMaterial color="#E2E8F0" roughness={0.4} />
          </RoundedBox>
          <mesh position={[-0.45, 0.22, 0.15]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.18, 16]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
          {/* Poste del semáforo de muelle */}
          <mesh position={[0.8, 0.65, 0.25]} castShadow>
            <cylinderGeometry args={[0.045, 0.055, 1.3, 12]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.8, 1.32, 0.25]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color="#FFB800" emissive="#F59E0B" emissiveIntensity={0.9} />
          </mesh>
        </group>
      );
    case 'c8_h2': // Carretilla con horquillas altas apoyada al suelo (y=1.3 -> -1.3)
      return <ForkliftDetailed3D forksHigh={true} scale={0.95} position={[0, -1.3, 0]} />;
    case 'c8_h3': // Puesto de llaves CAE en el suelo (y=1.1 -> -1.1)
      return (
        <group position={[0, -1.1, 0]}>
          <RoundedBox args={[0.85, 0.85, 0.55]} radius={0.04} position={[0, 0.425, 0]} castShadow>
            <meshStandardMaterial color="#475569" />
          </RoundedBox>
          <mesh position={[0, 0.88, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.12, 0.03, 8, 16]} />
            <meshStandardMaterial color="#FFB800" metalness={0.85} />
          </mesh>
        </group>
      );
    case 'c8_h4': // Cartel prohibición con poste al suelo (y=0.6 -> -0.6)
      return (
        <SafetySign3D
          kind="prohibition"
          withPost={true}
          postHeight={0.6}
          scale={0.95}
          position={[0, 0, 0]}
        />
      );
    case 'c8_h5': // Pórtico ROPS y cinturón sobre peana al suelo (y=0.6 -> -0.6)
      return (
        <group position={[0, -0.6, 0]}>
          <RoundedBox args={[0.85, 0.14, 0.72]} radius={0.03} position={[0, 0.07, 0]} receiveShadow>
            <meshStandardMaterial color="#334155" />
          </RoundedBox>
          <RoundedBox args={[0.72, 0.72, 0.6]} radius={0.03} position={[0, 0.5, 0]}>
            <meshStandardMaterial color="#1E293B" wireframe />
          </RoundedBox>
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[0.45, 0.1, 0.35]} />
            <meshStandardMaterial color="#EA580C" />
          </mesh>
        </group>
      );

    default:
      return (
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#38BDF8" />
        </mesh>
      );
  }
};

/**
 * Escenario arquitectónico de fondo para cada desafío (siempre apoyado en y = 0).
 */
const ChallengeEnvironmentBackdrop: React.FC<{ sceneType: Challenge3DDefinition['sceneType'] }> = ({
  sceneType,
}) => {
  switch (sceneType) {
    case 'orden_almacen':
      return (
        <group position={[0, 0, -1.7]}>
          <PalletRack3D bentPost={false} position={[0.4, 0, 0]} scale={0.95} />
        </group>
      );
    case 'vestir_epi':
      return (
        <group position={[0, 0, -1.8]}>
          {/* Andamio completo con 4 patas verticales apoyadas en el suelo */}
          {[-2.6, 2.6].map((x) =>
            [-0.35, 0.35].map((z) => (
              <mesh key={`${x}_${z}`} position={[x, 1.2, z]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.65} />
              </mesh>
            ))
          )}
          <RoundedBox args={[5.6, 0.12, 0.8]} radius={0.02} position={[0, 1.4, 0]}>
            <meshStandardMaterial color="#94A3B8" metalness={0.6} />
          </RoundedBox>
          <mesh position={[0, 2.2, 0.35]}>
            <boxGeometry args={[5.4, 0.07, 0.07]} />
            <meshStandardMaterial color="#FFB800" />
          </mesh>
        </group>
      );
    case 'panel_electrico':
      return <ElectricalPanel3D position={[0, 0, -1.6]} scale={1.15} />;
    case 'estacion_ergonomica':
      return <OfficeWorkstation3D ergonomic={false} position={[0, 0, -1.25]} scale={0.92} />;
    default:
      return null;
  }
};

const HotspotMarker3D: React.FC<{
  hotspot: ChallengeHotspot3D;
  index: number;
  isSelected: boolean;
  revealed: boolean;
  onToggle: () => void;
}> = ({ hotspot, index, isSelected, revealed, onToggle }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = isSelected ? 1.15 : 1 + Math.sin(clock.getElapsedTime() * 4 + index) * 0.08;
      ringRef.current.scale.set(s, s, 1);
    }
  });

  const ringColor = revealed
    ? hotspot.isCorrect
      ? '#10B981'
      : '#EF4444'
    : isSelected
    ? '#FFB800'
    : '#38BDF8';

  const badgeYOffset = hotspot.position[1] > 1.7 ? 0.58 : 0.72;

  return (
    <group
      position={hotspot.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {/* Modelo 3D físico apoyado en el suelo */}
      <HotspotPhysicalProp3D id={hotspot.id} />

      {/* Aro luminoso de selección apoyado exactamente a ras de suelo (world y = 0.02) */}
      <mesh
        ref={ringRef}
        position={[0, -hotspot.position[1] + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.52, 0.66, 28]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={isSelected || hovered || revealed ? 1.0 : 0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Marcador numérico compacto (#1..#5) */}
      <Html position={[0, badgeYOffset, 0]} center zIndexRange={[10, 0]}>
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
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.5, 8.2], fov: 44 }}>
        <color attach="background" args={['#1B283C']} />
        <ambientLight intensity={1.05} />
        <hemisphereLight args={['#E0F2FE', '#334155', 0.85]} />
        <directionalLight position={[6, 11, 8]} intensity={1.75} castShadow />
        <directionalLight position={[-6, 6, 4]} intensity={0.8} color="#93C5FD" />

        {/* Suelo de hormigón industrial claro y pared trasera */}
        <RoundedBox args={[8.4, 0.3, 5.8]} radius={0.08} position={[0, -0.15, 0]} receiveShadow>
          <meshStandardMaterial color="#475569" metalness={0.2} roughness={0.7} />
        </RoundedBox>
        <RoundedBox args={[8.4, 3.4, 0.25]} radius={0.05} position={[0, 1.65, -2.75]} receiveShadow>
          <meshStandardMaterial color="#2A3A52" metalness={0.25} roughness={0.6} />
        </RoundedBox>
        <mesh position={[0, 0.01, 2.86]}>
          <boxGeometry args={[8.3, 0.04, 0.08]} />
          <meshStandardMaterial color="#FFB800" />
        </mesh>

        <ChallengeEnvironmentBackdrop sceneType={challenge.sceneType} />

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
          target={[0, 0.9, 0]}
          enablePan={false}
          minDistance={4.2}
          maxDistance={12.0}
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
      </Canvas>
    </div>
  );
};
