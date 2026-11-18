# Licencias y Atribuciones de Recursos Multimedia
## PRL-OCA 3D ONLINE (`ASSETS_LICENSES.md`)

Todos los elementos tridimensionales, logotipos, efectos de sonido, composiciones musicales ambientales y contenidos formativos incluidos en **PRL-OCA 3D ONLINE** son originales o utilizan bibliotecas de código abierto con licencias permisivas compatibles con proyectos educativos y comerciales. No se utiliza ningún modelo comercial propietario sin autorización ni pistas musicales con copyright restringido.

---

## 1. Modelos 3D, Escenarios, Fichas, Dados e Insignias

| Recurso 3D | Ubicación en el Repositorio | Autoría / Origen | Licencia |
| :--- | :--- | :--- | :--- |
| **Mascota 3D "Prevenito"** | `apps/web/src/scenes/Mascot3D.tsx` | Creación original procedural mediante Three.js / React Three Fiber | MIT |
| **Fichas 3D Animadas de Equipos** | `apps/web/src/characters/WorkerToken3D.tsx` | Creación original procedural con materiales PBR | MIT |
| **Dados 3D Biselados (1D6 / 2D6)** | `apps/web/src/characters/Dice3D.tsx` | Creación original procedural con geometría `RoundedBox` | MIT |
| **Insignias 3D Desbloqueables (7)** | `apps/web/src/characters/Badge3D.tsx` | Creación original procedural con Three.js | MIT |
| **48 Casillas 3D e Iconografía 3D** | `apps/web/src/board/Tile3D.tsx` | Creación original procedural con Three.js | MIT |
| **12 Zonas Industriales 3D (Grúa, Carretilla, Taller, Almacén, etc.)** | `apps/web/src/board/IndustrialZones3D.tsx` | Creación original procedural con Three.js | MIT |
| **8 Escenarios de Desafíos 3D Interactivos** | `apps/web/src/scenes/ChallengeScene3D.tsx` | Creación original procedural con Three.js | MIT |
| **Logotipo y Escudo SVG PRL-OCA 3D** | `apps/web/public/favicon.svg` | Diseño vectorial original para el proyecto | MIT |

---

## 2. Música Ambiental y Efectos de Sonido

| Recurso de Audio | Ubicación en el Repositorio | Tecnología / Origen | Licencia |
| :--- | :--- | :--- | :--- |
| **6 Temas Musicales Ambientales** (*Menú, Tablero, Suspense, Victoria, Derrota, Emergencia*) | `apps/web/src/audio/SoundEngine.ts` | Síntesis polifónica generativa en tiempo real mediante **Web Audio API** del navegador | Dominio Público / MIT (100% original libre de regalías) |
| **18 Efectos de Sonido de Juego** (*Dados, Fichas, Casillas, Acierto, Error, Sirena, Extintor, Insignias, Victoria*) | `apps/web/src/audio/SoundEngine.ts` | Síntesis de osciladores y envolventes ADSR mediante **Web Audio API** | Dominio Público / MIT (100% original libre de regalías) |

---

## 3. Bibliotecas de Código Abierto e Iconografía UI

| Biblioteca / Paquete | Uso en el Proyecto | Licencia |
| :--- | :--- | :--- |
| **Three.js** (`three`) | Motor gráfico WebGL 3D | MIT License |
| **React Three Fiber** (`@react-three/fiber`) | Renderizador declarativo React para Three.js | MIT License |
| **React Three Drei** (`@react-three/drei`) | Controles de cámara orbital, iluminación y primitivas 3D | MIT License |
| **Lucide Icons** (`lucide-react`) | Iconografía vectorial de apoyo en botones de interfaz | ISC License |
| **GSAP** (`gsap`) | Transiciones y animaciones de cámara/interfaz | Standard "No Charge" GreenSock License |
| **Zustand** (`zustand`) | Gestión de estado en el cliente | MIT License |
| **Zod** (`zod`) | Validación de esquemas en cliente y servidor | MIT License |

---

## 4. Contenidos Normativos de Prevención de Riesgos Laborales

Las referencias legislativas citadas en el banco de preguntas y en las explicaciones pedagógicas corresponden a disposiciones oficiales públicas del **Boletín Oficial del Estado (BOE)** y Guías Técnicas del **Instituto Nacional de Seguridad y Salud en el Trabajo (INSST)** de España (Ley 31/1995, RD 39/1997, RD 485/1997, RD 486/1997, RD 487/1997, RD 488/1997, RD 664/1997, RD 773/1997, RD 1215/1997, RD 1627/1997, RD 374/2001, RD 614/2001, RD 171/2004, RD 286/2006 y RD 513/2017).
