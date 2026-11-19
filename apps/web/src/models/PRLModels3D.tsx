import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Generates crisp 2D CanvasTextures for industrial safety signs, checklists,
 * monitors, and technical plaques so 3D props carry unmistakable visual meaning.
 */
function makeSignCanvasTexture(
  bg: string,
  border: string,
  symbol: string,
  title?: string,
  textColor = '#FFFFFF'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = border;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, 240, 240);

    ctx.fillStyle = textColor;
    const baseSize = symbol.length >= 6 ? 48 : symbol.length >= 4 ? 64 : 110;
    ctx.font = title
      ? `900 ${baseSize}px Inter, Segoe UI, sans-serif`
      : '900 120px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 128, title ? 105 : 128);

    if (title) {
      ctx.font = '900 28px Inter, Segoe UI, sans-serif';
      ctx.fillText(title, 128, 194);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeWarningTriangleTexture(symbol = '!'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#FFB800';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(128, 20);
    ctx.lineTo(238, 226);
    ctx.lineTo(18, 226);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 124px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 128, 162);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const SafetyHelmet3D: React.FC<{
  color?: string;
  withChinStrap?: boolean;
  scale?: number;
  position?: [number, number, number];
}> = ({ color = '#FFB800', withChinStrap = false, scale = 1, position = [0, 0, 0] }) => (
  <group position={position} scale={scale}>
    {/* Cúpula del casco */}
    <mesh castShadow>
      <sphereGeometry args={[0.32, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.54]} />
      <meshStandardMaterial color={color} metalness={0.25} roughness={0.25} />
    </mesh>
    {/* Cresta superior reforzada */}
    <RoundedBox args={[0.1, 0.08, 0.56]} radius={0.03} position={[0, 0.28, 0]} castShadow>
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.22} />
    </RoundedBox>
    {/* Visera frontal */}
    <mesh position={[0, 0.02, 0.22]} rotation={[0.18, 0, 0]} castShadow>
      <cylinderGeometry args={[0.32, 0.35, 0.045, 24, 1, false, -Math.PI * 0.38, Math.PI * 0.76]} />
      <meshStandardMaterial color="#F59E0B" metalness={0.25} roughness={0.3} />
    </mesh>
    {/* Banda perimetral interior */}
    <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.31, 0.025, 10, 24]} />
      <meshStandardMaterial color="#1E293B" roughness={0.6} />
    </mesh>
    {/* Barbuquejo para trabajos en altura */}
    {withChinStrap && (
      <mesh position={[0, -0.14, 0.06]} rotation={[0.25, 0, 0]}>
        <torusGeometry args={[0.26, 0.022, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#0F172A" roughness={0.7} />
      </mesh>
    )}
  </group>
);

export const SafetyHarness3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    {/* Maniquí torso de referencia */}
    <RoundedBox args={[0.42, 0.58, 0.22]} radius={0.07} position={[0, 0.35, 0]} castShadow>
      <meshStandardMaterial color="#334155" roughness={0.6} />
    </RoundedBox>
    {/* Cintas amarillas de hombros y pecho EN 361 */}
    <mesh position={[-0.12, 0.36, 0]} castShadow>
      <boxGeometry args={[0.07, 0.62, 0.25]} />
      <meshStandardMaterial color="#FFB800" emissive="#F59E0B" emissiveIntensity={0.2} />
    </mesh>
    <mesh position={[0.12, 0.36, 0]} castShadow>
      <boxGeometry args={[0.07, 0.62, 0.25]} />
      <meshStandardMaterial color="#FFB800" emissive="#F59E0B" emissiveIntensity={0.2} />
    </mesh>
    {/* Cinta pectoral y hebilla metálica */}
    <mesh position={[0, 0.42, 0]}>
      <boxGeometry args={[0.45, 0.07, 0.25]} />
      <meshStandardMaterial color="#0284C7" />
    </mesh>
    <mesh position={[0, 0.42, 0.14]}>
      <boxGeometry args={[0.11, 0.09, 0.03]} />
      <meshStandardMaterial color="#E2E8F0" metalness={0.85} roughness={0.2} />
    </mesh>
    {/* Perniles */}
    <mesh position={[-0.12, 0.0, 0]}>
      <torusGeometry args={[0.1, 0.028, 8, 18]} />
      <meshStandardMaterial color="#FFB800" />
    </mesh>
    <mesh position={[0.12, 0.0, 0]}>
      <torusGeometry args={[0.1, 0.028, 8, 18]} />
      <meshStandardMaterial color="#FFB800" />
    </mesh>
    {/* Absorbedor de energía y doble cabo con mosquetón */}
    <RoundedBox args={[0.12, 0.22, 0.08]} radius={0.02} position={[0.24, 0.46, 0.1]} castShadow>
      <meshStandardMaterial color="#EF4444" roughness={0.4} />
    </RoundedBox>
    <mesh position={[0.32, 0.66, 0.1]} rotation={[0, 0, -0.35]}>
      <cylinderGeometry args={[0.022, 0.022, 0.42, 8]} />
      <meshStandardMaterial color="#F8FAFC" />
    </mesh>
    <mesh position={[0.42, 0.85, 0.1]}>
      <torusGeometry args={[0.055, 0.015, 8, 16]} />
      <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.15} />
    </mesh>
  </group>
);

export const SafetyBoots3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    {[-0.18, 0.18].map((x, idx) => (
      <group key={idx} position={[x, 0, 0]}>
        {/* Suela gruesa antideslizante */}
        <RoundedBox args={[0.22, 0.07, 0.44]} radius={0.02} position={[0, 0.035, 0.05]} castShadow>
          <meshStandardMaterial color="#0F172A" roughness={0.85} />
        </RoundedBox>
        {/* Caña de cuero S3 */}
        <RoundedBox args={[0.2, 0.26, 0.24]} radius={0.04} position={[0, 0.18, -0.04]} castShadow>
          <meshStandardMaterial color="#92400E" roughness={0.6} />
        </RoundedBox>
        {/* Empeine y puntera reforzada metálica/amarilla */}
        <RoundedBox args={[0.21, 0.14, 0.26]} radius={0.06} position={[0, 0.12, 0.11]} castShadow>
          <meshStandardMaterial color="#B45309" roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.11, 0.22]} castShadow>
          <sphereGeometry args={[0.1, 14, 12]} />
          <meshStandardMaterial color="#FFB800" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
    ))}
  </group>
);

export const Sneakers3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    {[-0.17, 0.17].map((x, idx) => (
      <group key={idx} position={[x, 0, 0]}>
        <RoundedBox args={[0.2, 0.05, 0.42]} radius={0.02} position={[0, 0.025, 0.04]} castShadow>
          <meshStandardMaterial color="#F8FAFC" roughness={0.5} />
        </RoundedBox>
        <RoundedBox args={[0.18, 0.13, 0.38]} radius={0.05} position={[0, 0.1, 0.02]} castShadow>
          <meshStandardMaterial color="#38BDF8" roughness={0.7} />
        </RoundedBox>
      </group>
    ))}
  </group>
);

export const WaistBelt3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.26, 0.26, 0.12, 24, 1, true]} />
      <meshStandardMaterial color="#475569" roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0.15, 0.26]}>
      <boxGeometry args={[0.14, 0.1, 0.03]} />
      <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
    </mesh>
  </group>
);

export const FireExtinguisher3D: React.FC<{
  variant?: 'abc' | 'co2';
  position?: [number, number, number];
  scale?: number;
}> = ({ variant = 'abc', position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    {/* Botella roja */}
    <mesh position={[0, 0.34, 0]} castShadow>
      <cylinderGeometry args={[0.16, 0.16, 0.56, 20]} />
      <meshStandardMaterial color="#DC2626" metalness={0.45} roughness={0.28} />
    </mesh>
    {/* Hombro redondeado */}
    <mesh position={[0, 0.62, 0]} castShadow>
      <sphereGeometry args={[0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      <meshStandardMaterial color="#DC2626" metalness={0.45} roughness={0.28} />
    </mesh>
    {/* Etiqueta blanca/amarilla */}
    <mesh position={[0, 0.36, 0.162]}>
      <planeGeometry args={[0.18, 0.24]} />
      <meshStandardMaterial color={variant === 'co2' ? '#E2E8F0' : '#FEF08A'} />
    </mesh>
    {/* Válvula superior y maneta */}
    <mesh position={[0, 0.78, 0]}>
      <cylinderGeometry args={[0.04, 0.04, 0.12, 12]} />
      <meshStandardMaterial color="#0F172A" metalness={0.7} />
    </mesh>
    <mesh position={[0.08, 0.82, 0]} rotation={[0, 0, -0.25]}>
      <boxGeometry args={[0.16, 0.03, 0.04]} />
      <meshStandardMaterial color="#1E293B" metalness={0.7} />
    </mesh>
    {/* Manguera y bocacha (difusor ancho negro si es CO2) */}
    <mesh position={[-0.17, 0.54, 0.08]} rotation={[0.2, 0, 0.25]}>
      <cylinderGeometry args={[0.02, 0.02, 0.38, 8]} />
      <meshStandardMaterial color="#0F172A" roughness={0.8} />
    </mesh>
    {variant === 'co2' ? (
      <mesh position={[-0.24, 0.32, 0.14]} rotation={[0.3, 0, 0.2]}>
        <cylinderGeometry args={[0.035, 0.1, 0.26, 16]} />
        <meshStandardMaterial color="#0F172A" roughness={0.5} />
      </mesh>
    ) : (
      <mesh position={[-0.22, 0.35, 0.12]}>
        <cylinderGeometry args={[0.02, 0.035, 0.1, 12]} />
        <meshStandardMaterial color="#0F172A" />
      </mesh>
    )}
  </group>
);

export const BIEFireCabinet3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <RoundedBox args={[0.85, 0.85, 0.24]} radius={0.04} position={[0, 0.425, 0]} castShadow>
      <meshStandardMaterial color="#DC2626" metalness={0.4} roughness={0.3} />
    </RoundedBox>
    {/* Ventana cristal */}
    <mesh position={[0, 0.425, 0.125]}>
      <planeGeometry args={[0.66, 0.66]} />
      <meshStandardMaterial color="#0F172A" roughness={0.2} />
    </mesh>
    {/* Devanadera y manguera enrollada interior */}
    <mesh position={[0, 0.425, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.24, 0.24, 0.05, 20]} />
      <meshStandardMaterial color="#EF4444" />
    </mesh>
    <mesh position={[0, 0.425, 0.16]}>
      <torusGeometry args={[0.14, 0.035, 10, 20]} />
      <meshStandardMaterial color="#F8FAFC" />
    </mesh>
  </group>
);

export const SafetySign3D: React.FC<{
  kind: 'warning' | 'exit' | 'assembly' | 'fire' | 'prohibition' | 'obligation' | 'load_plate';
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  withPost?: boolean;
  postHeight?: number;
}> = ({
  kind,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  withPost = false,
  postHeight = 1.0,
}) => {
  const texture = useMemo(() => {
    switch (kind) {
      case 'warning':
        return makeWarningTriangleTexture('⚡');
      case 'exit':
        return makeSignCanvasTexture('#10B981', '#FFFFFF', 'SALIDA →', 'EVACUACIÓN');
      case 'assembly':
        return makeSignCanvasTexture('#059669', '#FFFFFF', '⛨', 'P. ENCUENTRO');
      case 'fire':
        return makeSignCanvasTexture('#DC2626', '#FFFFFF', '🧯', 'EXTINTOR');
      case 'prohibition':
        return makeSignCanvasTexture('#FFFFFF', '#DC2626', '🚫', 'PROHIBIDO', '#DC2626');
      case 'obligation':
        return makeSignCanvasTexture('#0284C7', '#FFFFFF', '⛑', 'OBLIGATORIO');
      case 'load_plate':
        return makeSignCanvasTexture('#F8FAFC', '#0284C7', '1500 kg', 'CARGA MÁX', '#0F172A');
    }
  }, [kind]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[0.72, 0.72, 0.06]} radius={0.03} castShadow>
        <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[0.66, 0.66]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
      {withPost && (
        <group>
          <mesh position={[0, -postHeight / 2, -0.02]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, postHeight, 12]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, -postHeight + 0.025, -0.02]} receiveShadow castShadow>
            <cylinderGeometry args={[0.24, 0.28, 0.05, 18]} />
            <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export const CircularSawBench3D: React.FC<{
  guarded?: boolean;
  position?: [number, number, number];
  scale?: number;
}> = ({ guarded = false, position = [0, 0, 0], scale = 1 }) => {
  const bladeRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (bladeRef.current) {
      bladeRef.current.rotation.z -= delta * 8;
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* Patas y mesa metálica */}
      {[
        [-0.55, 0.35, -0.35],
        [0.55, 0.35, -0.35],
        [-0.55, 0.35, 0.35],
        [0.55, 0.35, 0.35],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <boxGeometry args={[0.09, 0.7, 0.09]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <RoundedBox args={[1.35, 0.1, 0.9]} radius={0.02} position={[0, 0.72, 0]} castShadow>
        <meshStandardMaterial color="#94A3B8" metalness={0.55} roughness={0.3} />
      </RoundedBox>
      {/* Disco dentado de corte */}
      <mesh ref={bladeRef} position={[0, 0.85, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.03, 18]} />
        <meshStandardMaterial color="#E2E8F0" metalness={0.9} roughness={0.15} />
      </mesh>
      {guarded ? (
        <>
          {/* Carcasa de resguardo amarillo + seta de emergencia */}
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.16, 0.38, 0.72]} />
            <meshStandardMaterial
              color="#FFB800"
              transparent
              opacity={0.75}
              metalness={0.3}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0.55, 0.65, 0.46]}>
            <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
            <meshStandardMaterial color="#EF4444" emissive="#DC2626" emissiveIntensity={0.4} />
          </mesh>
        </>
      ) : (
        /* Aro rojo de peligro por hoja descubierta */
        <mesh position={[0, 0.85, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.35, 0.025, 8, 24]} />
          <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
};

export const OilSpill3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    {/* Charco brillante de aceite hidráulico */}
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[0.72, 24]} />
      <meshStandardMaterial
        color="#F59E0B"
        emissive="#78350F"
        emissiveIntensity={0.35}
        metalness={0.9}
        roughness={0.08}
      />
    </mesh>
    <mesh position={[0.35, 0.025, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.36, 20]} />
      <meshStandardMaterial color="#1E293B" metalness={0.95} roughness={0.05} />
    </mesh>
    {/* Bidón volcado originando el vertido */}
    <mesh position={[-0.48, 0.18, -0.2]} rotation={[0.2, 0.4, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.16, 0.16, 0.42, 16]} />
      <meshStandardMaterial color="#D97706" metalness={0.4} roughness={0.35} />
    </mesh>
  </group>
);

export const GasCylinder3D: React.FC<{
  chained?: boolean;
  position?: [number, number, number];
  scale?: number;
}> = ({ chained = false, position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale} rotation={chained ? [0, 0, 0] : [0.04, 0, -0.1]}>
    <mesh position={[0, 0.04, 0]} castShadow>
      <cylinderGeometry args={[0.2, 0.21, 0.08, 20]} />
      <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.4} />
    </mesh>
    <mesh position={[0, 0.58, 0]} castShadow>
      <cylinderGeometry args={[0.18, 0.18, 1.05, 20]} />
      <meshStandardMaterial color="#0284C7" metalness={0.5} roughness={0.3} />
    </mesh>
    <mesh position={[0, 1.1, 0]} castShadow>
      <sphereGeometry args={[0.18, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      <meshStandardMaterial color="#991B1B" metalness={0.45} roughness={0.3} />
    </mesh>
    {/* Manoreductor superior */}
    <mesh position={[0, 1.32, 0]}>
      <cylinderGeometry args={[0.045, 0.045, 0.14, 12]} />
      <meshStandardMaterial color="#FFB800" metalness={0.85} roughness={0.2} />
    </mesh>
    {chained && (
      <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.028, 8, 24]} />
        <meshStandardMaterial color="#CBD5E1" metalness={0.9} roughness={0.2} />
      </mesh>
    )}
  </group>
);

export const PalletRack3D: React.FC<{
  bentPost?: boolean;
  overhangingTop?: boolean;
  position?: [number, number, number];
  scale?: number;
}> = ({ bentPost = false, overhangingTop = false, position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    {/* 4 puntales azules con placas de anclaje al suelo */}
    {[
      [-0.9, 1.05, -0.42, false],
      [0.9, 1.05, -0.42, false],
      [-0.9, 1.05, 0.42, false],
      [0.9, 1.05, 0.42, bentPost],
    ].map(([x, y, z, isBent], idx) => (
      <group key={idx}>
        <mesh position={[Number(x), 0.02, Number(z)]} receiveShadow>
          <boxGeometry args={[0.18, 0.04, 0.18]} />
          <meshStandardMaterial color="#FFB800" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh
          position={[Number(x), Number(y), Number(z)]}
          rotation={isBent ? [0, 0, 0.18] : [0, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.09, 2.1, 0.09]} />
          <meshStandardMaterial
            color={isBent ? '#EF4444' : '#0284C7'}
            emissive={isBent ? '#DC2626' : '#000000'}
            emissiveIntensity={isBent ? 0.35 : 0}
            metalness={0.55}
            roughness={0.35}
          />
        </mesh>
      </group>
    ))}

    {/* Largueros naranjas horizontales */}
    {[0.75, 1.55].map((y, idx) => (
      <group key={idx} position={[0, y, 0]}>
        <mesh position={[0, 0, 0.42]} castShadow>
          <boxGeometry args={[1.9, 0.08, 0.08]} />
          <meshStandardMaterial color="#EA580C" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, -0.42]} castShadow>
          <boxGeometry args={[1.9, 0.08, 0.08]} />
          <meshStandardMaterial color="#EA580C" metalness={0.4} roughness={0.35} />
        </mesh>
      </group>
    ))}

    {/* Nivel inferior estable con palet de madera y cajas */}
    <mesh position={[-0.35, 0.84, 0]} castShadow>
      <boxGeometry args={[0.9, 0.09, 0.82]} />
      <meshStandardMaterial color="#B45309" roughness={0.75} />
    </mesh>
    <RoundedBox args={[0.75, 0.48, 0.7]} radius={0.03} position={[-0.35, 1.12, 0]} castShadow>
      <meshStandardMaterial color="#D97706" roughness={0.65} />
    </RoundedBox>

    {/* Nivel superior: si overhangingTop=true, palet torcido sobresaliendo peligrosamente */}
    <group
      position={overhangingTop ? [0.18, 1.65, 0.32] : [0, 1.64, 0]}
      rotation={overhangingTop ? [0.12, 0.14, -0.1] : [0, 0, 0]}
    >
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.92, 0.09, 0.82]} />
        <meshStandardMaterial color="#92400E" roughness={0.8} />
      </mesh>
      <RoundedBox args={[0.84, 0.5, 0.75]} radius={0.03} position={[0, 0.28, 0]} castShadow>
        <meshStandardMaterial
          color={overhangingTop ? '#EF4444' : '#F59E0B'}
          roughness={0.55}
        />
      </RoundedBox>
    </group>
  </group>
);

export const ElectricalPanel3D: React.FC<{
  withPadlock?: boolean;
  disconnectedGround?: boolean;
  position?: [number, number, number];
  scale?: number;
}> = ({ withPadlock = false, disconnectedGround = false, position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    {/* Armario metálico */}
    <RoundedBox args={[1.9, 1.6, 0.55]} radius={0.05} position={[0, 0.9, -0.15]} castShadow>
      <meshStandardMaterial color="#64748B" metalness={0.6} roughness={0.35} />
    </RoundedBox>
    {/* Fondo interior del cuadro */}
    <mesh position={[0, 0.9, 0.13]}>
      <planeGeometry args={[1.65, 1.35]} />
      <meshStandardMaterial color="#1E293B" roughness={0.6} />
    </mesh>
    {/* 3 Embarrados de cobre desnudo */}
    {[-0.22, 0, 0.22].map((x, i) => (
      <mesh key={i} position={[x, 0.95, 0.16]} castShadow>
        <boxGeometry args={[0.07, 0.88, 0.05]} />
        <meshStandardMaterial
          color="#EA580C"
          emissive="#F97316"
          emissiveIntensity={0.35}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
    ))}
    {/* Seccionador izquierdo */}
    <RoundedBox args={[0.3, 0.4, 0.12]} radius={0.02} position={[-0.62, 1.05, 0.18]}>
      <meshStandardMaterial color="#0F172A" />
    </RoundedBox>
    <mesh position={[-0.62, 1.05, 0.27]} rotation={[0.4, 0, 0]}>
      <boxGeometry args={[0.14, 0.06, 0.14]} />
      <meshStandardMaterial color={withPadlock ? '#10B981' : '#EF4444'} />
    </mesh>
    {withPadlock && (
      <mesh position={[-0.56, 0.94, 0.28]}>
        <boxGeometry args={[0.1, 0.12, 0.05]} />
        <meshStandardMaterial color="#DC2626" />
      </mesh>
    )}
    {/* Puesta a tierra derecha (cable verde-amarillo suelto si disconnectedGround) */}
    <RoundedBox args={[0.3, 0.36, 0.12]} radius={0.02} position={[0.62, 0.72, 0.18]}>
      <meshStandardMaterial color="#334155" />
    </RoundedBox>
    <mesh
      position={[0.62, disconnectedGround ? 0.38 : 0.44, 0.24]}
      rotation={[0, 0, disconnectedGround ? 0.55 : 0]}
    >
      <cylinderGeometry args={[0.025, 0.025, 0.45, 8]} />
      <meshStandardMaterial
        color={disconnectedGround ? '#FACC15' : '#10B981'}
        emissive={disconnectedGround ? '#EAB308' : '#059669'}
        emissiveIntensity={0.3}
      />
    </mesh>
  </group>
);

export const OfficeWorkstation3D: React.FC<{
  ergonomic?: boolean;
  position?: [number, number, number];
  scale?: number;
}> = ({ ergonomic = false, position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    {/* Escritorio madera clara */}
    <RoundedBox args={[1.8, 0.08, 0.9]} radius={0.02} position={[0, 0.75, 0]} castShadow>
      <meshStandardMaterial color="#D97706" roughness={0.55} />
    </RoundedBox>
    {[
      [-0.8, 0.37, -0.35],
      [0.8, 0.37, -0.35],
      [-0.8, 0.37, 0.35],
      [0.8, 0.37, 0.35],
    ].map((p, i) => (
      <mesh key={i} position={p as [number, number, number]} castShadow>
        <boxGeometry args={[0.07, 0.74, 0.07]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.6} roughness={0.3} />
      </mesh>
    ))}
    {/* Monitor: bajo y ladeado si ergonomic=false, centrado y alto si ergonomic=true */}
    <group position={ergonomic ? [0, 1.18, -0.18] : [0.22, 0.98, -0.15]} rotation={[0, ergonomic ? 0 : -0.35, 0]}>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.25, 12]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} />
      </mesh>
      <RoundedBox args={[0.88, 0.52, 0.05]} radius={0.02} castShadow>
        <meshStandardMaterial color="#0F172A" metalness={0.4} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[0.8, 0.44]} />
        <meshStandardMaterial color="#38BDF8" emissive="#0284C7" emissiveIntensity={0.45} />
      </mesh>
    </group>
    {/* Teclado y ratón */}
    <RoundedBox args={[0.48, 0.025, 0.16]} radius={0.01} position={[0, 0.8, ergonomic ? 0.14 : 0.35]}>
      <meshStandardMaterial color="#334155" />
    </RoundedBox>
    {/* Silla ergonómica de 5 ruedas */}
    <group position={[-0.1, 0, 0.78]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 5]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.36, 12]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.8} />
      </mesh>
      <RoundedBox args={[0.48, 0.08, 0.46]} radius={0.03} position={[0, 0.45, 0]} castShadow>
        <meshStandardMaterial color="#0284C7" roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.44, 0.54, 0.08]} radius={0.04} position={[0, 0.78, 0.2]} castShadow>
        <meshStandardMaterial color="#0284C7" roughness={0.6} />
      </RoundedBox>
    </group>
  </group>
);

export const ForkliftDetailed3D: React.FC<{
  forksHigh?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ forksHigh = false, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) => (
  <group position={position} rotation={rotation} scale={scale}>
    {/* Chasis amarillo */}
    <RoundedBox args={[0.92, 0.48, 1.35]} radius={0.08} position={[0, 0.38, -0.1]} castShadow>
      <meshStandardMaterial color="#FFB800" metalness={0.35} roughness={0.35} />
    </RoundedBox>
    {/* Contrapeso trasero oscuro */}
    <RoundedBox args={[0.92, 0.42, 0.38]} radius={0.08} position={[0, 0.44, -0.66]} castShadow>
      <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
    </RoundedBox>
    {/* 4 Ruedas negras con llantas amarillas */}
    {[
      [-0.48, 0.18, 0.36],
      [0.48, 0.18, 0.36],
      [-0.46, 0.16, -0.52],
      [0.46, 0.16, -0.52],
    ].map((pos, i) => (
      <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.14, 16]} />
        <meshStandardMaterial color="#0F172A" roughness={0.85} />
      </mesh>
    ))}
    {/* Pórtico antivuelco ROPS (4 postes + techo) */}
    {[
      [-0.38, 0.92, 0.25],
      [0.38, 0.92, 0.25],
      [-0.38, 0.92, -0.45],
      [0.38, 0.92, -0.45],
    ].map((pos, i) => (
      <mesh key={i} position={pos as [number, number, number]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 8]} />
        <meshStandardMaterial color="#1E293B" metalness={0.7} />
      </mesh>
    ))}
    <RoundedBox args={[0.84, 0.06, 0.78]} radius={0.02} position={[0, 1.28, -0.1]} castShadow>
      <meshStandardMaterial color="#1E293B" metalness={0.6} />
    </RoundedBox>
    {/* Asiento del conductor */}
    <RoundedBox args={[0.38, 0.28, 0.36]} radius={0.04} position={[0, 0.74, -0.18]}>
      <meshStandardMaterial color="#EA580C" roughness={0.6} />
    </RoundedBox>
    {/* Mástil delantero vertical */}
    <mesh position={[-0.26, 0.88, 0.68]} castShadow>
      <boxGeometry args={[0.08, 1.5, 0.08]} />
      <meshStandardMaterial color="#0F172A" metalness={0.75} />
    </mesh>
    <mesh position={[0.26, 0.88, 0.68]} castShadow>
      <boxGeometry args={[0.08, 1.5, 0.08]} />
      <meshStandardMaterial color="#0F172A" metalness={0.75} />
    </mesh>
    {/* Horquillas y palet (elevadas peligrosamente si forksHigh=true) */}
    <group position={[0, forksHigh ? 1.28 : 0.16, 0.74]} rotation={forksHigh ? [0.08, 0, -0.1] : [0, 0, 0]}>
      <mesh position={[-0.18, 0, 0.34]} castShadow>
        <boxGeometry args={[0.08, 0.04, 0.7]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.85} />
      </mesh>
      <mesh position={[0.18, 0, 0.34]} castShadow>
        <boxGeometry args={[0.08, 0.04, 0.7]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.85} />
      </mesh>
      <RoundedBox args={[0.68, 0.38, 0.62]} radius={0.03} position={[0, 0.22, 0.38]} castShadow>
        <meshStandardMaterial color={forksHigh ? '#EF4444' : '#D97706'} roughness={0.6} />
      </RoundedBox>
    </group>
  </group>
);

export const Flames3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 11) * 0.12;
      ref.current.scale.set(scale, scale * s, scale);
    }
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh position={[0, 0.28, 0]}>
        <coneGeometry args={[0.26, 0.56, 8]} />
        <meshStandardMaterial color="#EA580C" emissive="#F97316" emissiveIntensity={1.1} />
      </mesh>
      <mesh position={[0.12, 0.22, 0.05]}>
        <coneGeometry args={[0.18, 0.44, 8]} />
        <meshStandardMaterial color="#FACC15" emissive="#FDE047" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-0.1, 0.2, -0.04]}>
        <coneGeometry args={[0.16, 0.4, 8]} />
        <meshStandardMaterial color="#EF4444" emissive="#DC2626" emissiveIntensity={1.1} />
      </mesh>
    </group>
  );
};

export const FirstAidKit3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <RoundedBox args={[0.56, 0.42, 0.22]} radius={0.04} castShadow>
      <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
    </RoundedBox>
    <mesh position={[0, 0.24, 0]}>
      <boxGeometry args={[0.22, 0.06, 0.06]} />
      <meshStandardMaterial color="#10B981" />
    </mesh>
    <mesh position={[0, 0, 0.12]}>
      <boxGeometry args={[0.22, 0.07, 0.02]} />
      <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.4} />
    </mesh>
    <mesh position={[0, 0, 0.12]}>
      <boxGeometry args={[0.07, 0.22, 0.02]} />
      <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.4} />
    </mesh>
  </group>
);

export const Goggles3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <RoundedBox args={[0.52, 0.2, 0.14]} radius={0.04} castShadow>
      <meshStandardMaterial color="#38BDF8" emissive="#0284C7" emissiveIntensity={0.35} metalness={0.5} roughness={0.15} />
    </RoundedBox>
    <mesh position={[0, 0, -0.05]}>
      <torusGeometry args={[0.22, 0.02, 8, 20, Math.PI]} />
      <meshStandardMaterial color="#0F172A" />
    </mesh>
  </group>
);

export const RespiratorMask3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh castShadow>
      <coneGeometry args={[0.22, 0.28, 16]} />
      <meshStandardMaterial color="#334155" roughness={0.5} />
    </mesh>
    <mesh position={[-0.18, -0.04, 0.08]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
      <meshStandardMaterial color="#EC4899" />
    </mesh>
    <mesh position={[0.18, -0.04, 0.08]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
      <meshStandardMaterial color="#EC4899" />
    </mesh>
  </group>
);

export const LabFlask3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 0.16, 0]} castShadow>
      <coneGeometry args={[0.24, 0.32, 20]} />
      <meshStandardMaterial color="#06B6D4" emissive="#0891B2" emissiveIntensity={0.45} transparent opacity={0.85} />
    </mesh>
    <mesh position={[0, 0.36, 0]}>
      <cylinderGeometry args={[0.06, 0.07, 0.18, 16]} />
      <meshStandardMaterial color="#E2E8F0" transparent opacity={0.75} />
    </mesh>
  </group>
);

export const Wrench3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale} rotation={[0, 0, 0.5]}>
    <mesh castShadow>
      <boxGeometry args={[0.1, 0.52, 0.05]} />
      <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
    </mesh>
    <mesh position={[0, 0.28, 0]}>
      <torusGeometry args={[0.11, 0.035, 8, 16, Math.PI * 1.4]} />
      <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
    </mesh>
    <mesh position={[0, -0.28, 0]} rotation={[0, 0, Math.PI]}>
      <torusGeometry args={[0.11, 0.035, 8, 16, Math.PI * 1.4]} />
      <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
    </mesh>
  </group>
);

export const Gear3D: React.FC<{
  color?: string;
  position?: [number, number, number];
  scale?: number;
}> = ({ color = '#FFB800', position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh castShadow>
      <torusGeometry args={[0.2, 0.065, 10, 12]} />
      <meshStandardMaterial color={color} metalness={0.75} roughness={0.25} />
    </mesh>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
        <boxGeometry args={[0.54, 0.08, 0.08]} />
        <meshStandardMaterial color={color} metalness={0.75} roughness={0.25} />
      </mesh>
    ))}
  </group>
);

export const QuestionMark3D: React.FC<{
  color?: string;
  position?: [number, number, number];
  scale?: number;
}> = ({ color = '#38BDF8', position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 0.14, 0]} rotation={[0, 0, -0.3]} castShadow>
      <torusGeometry args={[0.14, 0.05, 10, 20, Math.PI * 1.45]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} metalness={0.4} roughness={0.2} />
    </mesh>
    <mesh position={[0, -0.02, 0]} castShadow>
      <cylinderGeometry args={[0.048, 0.048, 0.14, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
    </mesh>
    <mesh position={[0, -0.17, 0]} castShadow>
      <sphereGeometry args={[0.06, 14, 14]} />
      <meshStandardMaterial color="#FFB800" emissive="#FFB800" emissiveIntensity={0.5} />
    </mesh>
  </group>
);

export const ClipboardMagnifier3D: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <RoundedBox args={[0.38, 0.48, 0.05]} radius={0.02} castShadow>
      <meshStandardMaterial color="#B45309" roughness={0.6} />
    </RoundedBox>
    <mesh position={[0, -0.02, 0.03]}>
      <planeGeometry args={[0.3, 0.38]} />
      <meshStandardMaterial color="#F8FAFC" />
    </mesh>
    <mesh position={[0, 0.23, 0.04]}>
      <boxGeometry args={[0.16, 0.06, 0.04]} />
      <meshStandardMaterial color="#94A3B8" metalness={0.85} />
    </mesh>
    {/* Lupa */}
    <mesh position={[0.12, -0.08, 0.09]}>
      <torusGeometry args={[0.11, 0.025, 8, 20]} />
      <meshStandardMaterial color="#0284C7" metalness={0.7} />
    </mesh>
  </group>
);
