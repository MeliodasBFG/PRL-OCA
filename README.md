# PRL-OCA 3D ONLINE
## Videojuego de Mesa 3D Multijugador de Prevención de Riesgos Laborales

**PRL-OCA 3D ONLINE** es una aplicación web y videojuego educativo tridimensional multijugador en tiempo real inspirado en el clásico *Juego de la Oca*, diseñado íntegramente para la formación práctica en **Prevención de Riesgos Laborales (PRL)**. Permite conectar simultáneamente hasta **15 participantes** (predeterminado: **3 equipos de 5 personas**) más el docente y espectadores desde ordenadores, portátiles, tablets o teléfonos móviles sin necesidad de instalaciones.

---

## Índice de Documentación

1. [¿Qué es PRL-OCA 3D ONLINE?](#1-qué-es-prl-oca-3d-online)
2. [Tecnologías Utilizadas](#2-tecnologías-utilizadas)
3. [Requisitos del Sistema](#3-requisitos-del-sistema)
4. [Instalación del Proyecto](#4-instalación-del-proyecto)
5. [Ejecución en Entorno Local](#5-ejecución-en-entorno-local)
6. [Estructura del Monorepositorio](#6-estructura-del-monorepositorio)
7. [Configuración de Cloudflare](#7-configuración-de-cloudflare)
8. [Configuración de Durable Objects (`GameRoom`)](#8-configuración-de-durable-objects-gameroom)
9. [Configuración de Cloudflare D1 (Base de Datos)](#9-configuración-de-cloudflare-d1-base-de-datos)
10. [Configuración de Cloudflare R2 (Almacenamiento 3D)](#10-configuración-de-cloudflare-r2-almacenamiento-3d)
11. [Configuración de Variables de Entorno](#11-configuración-de-variables-de-entorno)
12. [Conexión con GitHub y Ramas (`main` / `development`)](#12-conexión-con-github-y-ramas-main--development)
13. [Despliegue del Frontend en Cloudflare Pages](#13-despliegue-del-frontend-en-cloudflare-pages)
14. [Despliegue del Backend en Cloudflare Workers](#14-despliegue-del-backend-en-cloudflare-workers)
15. [Cómo Iniciar una Partida en el Aula](#15-cómo-iniciar-una-partida-en-el-aula)
16. [Cómo Crear, Importar y Exportar Preguntas](#16-cómo-crear-importar-y-exportar-preguntas)
17. [Cómo Administrar a los Participantes (Panel Docente)](#17-cómo-administrar-a-los-participantes-panel-docente)
18. [Cómo Añadir Nuevos Modelos 3D (GLB / Procedurales)](#18-cómo-añadir-nuevos-modelos-3d-glb--procedurales)
19. [Cómo Añadir Efectos de Sonido y Música](#19-cómo-añadir-efectos-de-sonido-y-música)
20. [Solución de Problemas Habituales (Troubleshooting)](#20-solución-de-problemas-habituales-troubleshooting)

Documentos complementarios incluidos en la raíz del proyecto:
- [DEPLOYMENT.md](./DEPLOYMENT.md): Guía paso a paso de publicación en Cloudflare Pages y Workers.
- [GAME_DESIGN.md](./GAME_DESIGN.md): Manual de diseño de juego, catálogo de las 48 casillas, reglas y puntuaciones.
- [ASSETS_LICENSES.md](./ASSETS_LICENSES.md): Licencias y atribuciones de recursos 3D, audio y tipografías.

---

## 1. ¿Qué es PRL-OCA 3D ONLINE?

Es un videojuego formativo comercial en 3D donde los participantes recorren un **complejo industrial tridimensional de 48 casillas** dividido en **12 zonas productivas** (Fábrica, Almacén Logístico, Taller Mecánico, Oficinas PVD, Obra de Construcción, Laboratorio Químico, Hospital, Cocina Industrial, Muelle de Carga, Sala de Control, Subestación Eléctrica y Base de Emergencias).

Características principales:
- **Hasta 15 participantes simultáneos** organizados por defecto en **3 equipos de 5 personas** (Equipo Azul, Equipo Naranja y Equipo Verde) o en modalidad individual/personalizable (2 a 5 equipos).
- **Roles rotativos por turno** dentro de cada equipo (*Coordinador/a, Lector/a, Analista del Riesgo, Portavoz y Responsable de la Decisión*) para asegurar la participación activa de todos los alumnos.
- **Servidor autoritativo en tiempo real**: el lanzamiento de dados (`1D6` o `2D6`), el avance de fichas casilla por casilla y la validación de respuestas se deciden en el servidor.
- **8 Desafíos 3D Interactivos** integrados en el tablero (inspección de taller 3D, equipamiento de EPI en altura, evacuación de edificio, extinción de incendios, orden en estanterías, riesgo eléctrico LOTO, ergonomía PVD e investigación de accidentes).
- **Explicación pedagógica fundamentada en la legislación española de PRL** (*Ley 31/1995, RD 485/1997, RD 486/1997, RD 487/1997, RD 488/1997, RD 614/2001, RD 773/1997, RD 1215/1997, RD 1627/1997, RD 513/2017*).

---

## 2. Tecnologías Utilizadas

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend 3D & UI** | React 18, TypeScript 5, Vite 6, Three.js, `@react-three/fiber`, `@react-three/drei`, GSAP, Lucide Icons |
| **Estado y Validación** | Zustand 5, Zod 3 (`@prl-oca/shared`) |
| **Audio de Videojuego** | Web Audio API (Sintetizador polifónico original con 6 temas musicales y 18 efectos de sonido) |
| **Backend Tiempo Real** | Cloudflare Workers (`prl-oca-realtime`), Cloudflare Durable Objects (`GameRoom` con WebSocket Hibernation) |
| **Persistencia Cloud** | Cloudflare D1 (SQLite serverless para preguntas e historial) y Cloudflare R2 (opcional para activos GLB pesados) |
| **Calidad y CI/CD** | Vitest (pruebas unitarias y simulación de 15 clientes + docente), GitHub Actions |

---

## 3. Requisitos del Sistema

- **Node.js**: versión `20.0.0` o superior (recomendado Node `22 LTS` o `24`).
- **npm**: versión `10+` (con soporte de *npm workspaces*).
- **Git**: versión `2.30+`.
- **Navegador moderno** con soporte WebGL2 (Chrome, Edge, Firefox, Safari en Windows, macOS, Linux, Android, iPhone y iPad).

---

## 4. Instalación del Proyecto

Clona el repositorio e instala las dependencias desde la raíz del monorepositorio:

```bash
git clone <URL_DE_TU_REPOSITORIO_GITHUB>
cd prl-oca-3d
npm install
```

Copia el archivo de variables de entorno de ejemplo:

```bash
cp .env.example apps/web/.env
```

---

## 5. Ejecución en Entorno Local

### Iniciar el Frontend Web 3D (Puerto 5173)
```bash
npm run dev
```
Abre `http://localhost:5173` en tu navegador.
> **Nota:** El frontend incluye sincronización multi-pestaña inmediata (`BroadcastChannel`) y motor local de respaldo, por lo que puedes probar partidas entre varias pestañas incluso antes de levantar el Worker.

### Iniciar el Backend Cloudflare Worker + Durable Objects (Puerto 8787)
En una segunda terminal:
```bash
npm run dev:realtime
```
El Worker escuchará en `http://localhost:8787` y aceptará conexiones WebSocket en `ws://localhost:8787/ws/:roomCode`.

### Ejecutar Pruebas Automatizadas y Verificación de Tipos
```bash
npm run typecheck
npm test
npm run build
```

---

## 6. Estructura del Monorepositorio

```text
prl-oca-3d/
├── apps/
│   ├── web/                        # Aplicación Frontend React + Vite + Three.js
│   │   ├── public/                 # Favicon, _redirects y _headers para Cloudflare Pages
│   │   └── src/
│   │       ├── audio/              # Sintetizador Web Audio API (6 músicas + 18 efectos)
│   │       ├── board/              # Casillas 3D (Tile3D), 12 Zonas Industriales 3D y Tablero 2D
│   │       ├── characters/         # Fichas animadas (WorkerToken3D), Dados 3D y Medallas 3D
│   │       ├── components/         # Modales de Pregunta, Desafío 3D, QR, Panel Docente, Editor
│   │       ├── multiplayer/        # Cliente WebSocket con reconexión automática
│   │       ├── scenes/             # Escenas R3F (Home, Lobby, Board, Challenge3D, Mascota)
│   │       ├── screens/            # Pantallas principales de la aplicación
│   │       ├── stores/             # Estado global Zustand (useGameStore)
│   │       └── styles/             # Sistema de diseño visual industrial y responsive
│   │
│   └── realtime/                   # Backend Cloudflare Worker (prl-oca-realtime)
│       ├── src/
│       │   ├── index.ts            # Router HTTP REST y upgrade WebSocket
│       │   ├── durable-objects/    # Clase Durable Object `GameRoom` con Hibernation API
│       │   ├── game-engine/        # Motor autoritativo del servidor
│       │   ├── security/           # Tokens de docente, CORS y Rate Limiting
│       │   └── services/           # Servicio de base de datos Cloudflare D1
│       └── wrangler.jsonc          # Configuración de Wrangler (DO, D1, R2, entornos)
│
├── packages/
│   └── shared/                     # Paquete compartido (@prl-oca/shared)
│       └── src/
│           ├── constants/          # 48 casillas, 48+ preguntas PRL, 8 desafíos 3D, 7 insignias
│           ├── engine/             # Lógica determinista compartida
│           ├── schemas/            # Esquemas de validación Zod
│           └── types/              # Interfaces TypeScript
│
├── migrations/
│   └── 0001_initial_schema.sql     # Esquema inicial para Cloudflare D1
├── tests/
│   ├── gameEngine.test.ts          # Pruebas unitarias de tablero, dados y reglas
│   └── multiplayer15.test.ts       # Prueba automatizada con 15 jugadores + 1 docente
├── .github/workflows/
│   ├── ci.yml                      # Integración continua en cada push/PR
│   └── deploy.yml                  # Despliegue manual opcional con Wrangler
├── DEPLOYMENT.md
├── GAME_DESIGN.md
├── ASSETS_LICENSES.md
└── README.md
```

---

## 7. Configuración de Cloudflare

1. Crea una cuenta o inicia sesión en [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Autentica Wrangler desde tu terminal:
   ```bash
   npx wrangler login
   ```

---

## 8. Configuración de Durable Objects (`GameRoom`)

El archivo `apps/realtime/wrangler.jsonc` ya declara el binding `GAME_ROOMS` asociado a la clase `GameRoom` y la migración `v1` con `new_sqlite_classes: ["GameRoom"]`. Cada sala creada con un código (ej. `PRL482`) instancia un Durable Object aislado que coordina en memoria y almacenamiento persistente a los 15 jugadores.

---

## 9. Configuración de Cloudflare D1 (Base de Datos)

1. Crea la base de datos D1:
   ```bash
   npx wrangler d1 create prl-oca-db
   ```
2. Copia el `database_id` devuelto por la consola y sustituye el marcador `REPLACE_WITH_YOUR_CLOUDFLARE_D1_DATABASE_ID` en `apps/realtime/wrangler.jsonc`.
3. Aplica las migraciones SQL:
   ```bash
   npx wrangler d1 migrations apply prl-oca-db --local
   npx wrangler d1 migrations apply prl-oca-db --remote
   ```

---

## 10. Configuración de Cloudflare R2 (Almacenamiento 3D)

El proyecto genera por defecto todos sus escenarios, personajes, dados e insignias mediante geometrías PBR procedurales optimizadas para carga instantánea en móviles. Si deseas alojar modelos `.glb` pesados adicionales en Cloudflare R2:
1. Crea el bucket: `npx wrangler r2 bucket create prl-oca-3d-assets`
2. Descomenta la sección `r2_buckets` en `apps/realtime/wrangler.jsonc`.

---

## 11. Configuración de Variables de Entorno

En `apps/web/.env` (o en la configuración de Cloudflare Pages):
- `VITE_API_URL`: URL HTTPS del Worker desplegado (ej. `https://prl-oca-realtime.<tu-subdominio>.workers.dev`).
- `VITE_WS_URL`: URL WSS del Worker desplegado (ej. `wss://prl-oca-realtime.<tu-subdominio>.workers.dev`).

Las claves o variables privadas del backend se configuran siempre en Cloudflare (`wrangler secret put`), nunca en el frontend.

---

## 12. Conexión con GitHub y Ramas (`main` / `development`)

El repositorio está estructurado con dos ramas principales:
- `main`: Rama de producción estable.
- `development`: Rama de integración y previsualizaciones (*Preview Deployments*).

Al hacer `git push` a cualquiera de las dos ramas, el flujo `.github/workflows/ci.yml` verifica automáticamente la compilación TypeScript, ejecuta las pruebas de 15 jugadores con Vitest y comprueba el empaquetado de producción.

---

## 13. Despliegue del Frontend en Cloudflare Pages

1. En Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Selecciona tu repositorio GitHub `prl-oca-3d`.
3. Configura los parámetros de compilación:
   - **Rama de producción:** `main`
   - **Comando de compilación (Build command):** `npm run build:web`
   - **Directorio de salida (Build output directory):** `apps/web/dist`
   - **Variables de entorno:** Añade `VITE_API_URL` y `VITE_WS_URL`.

---

## 14. Despliegue del Backend en Cloudflare Workers

Desde la raíz del proyecto o dentro de `apps/realtime`:
```bash
cd apps/realtime
npx wrangler deploy
```
O bien conecta el directorio `apps/realtime` mediante **Workers Builds** nativo en el panel de Cloudflare. Consulta todos los detalles en [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 15. Cómo Iniciar una Partida en el Aula

1. El formador entra en la aplicación y pulsa **CREAR NUEVA PARTIDA**.
2. Revisa la configuración (por defecto: **3 equipos de 5 personas = 15 participantes**, dado 1D6, dificultad progresiva) e introduce su clave de docente (por defecto `PRL2026`).
3. En la **Sala de Espera 3D**, el profesor proyecta en pantalla el **Código QR**, el código alfanumérico (ej. `PRL742`) o comparte el enlace directo.
4. Los alumnos acceden desde sus móviles o portátiles sin instalar nada y ven su equipo asignado y su rol del primer turno.
5. Cuando todos están listos, el profesor pulsa **INICIAR PARTIDA EN TABLERO 3D**.

---

## 16. Cómo Crear, Importar y Exportar Preguntas

1. En la pantalla de inicio, en la barra inferior del docente, introduce el PIN y abre **Gestionar Banco de Preguntas PRL**.
2. Puedes **Crear**, **Editar**, **Duplicar**, **Activar/Desactivar** o **Eliminar** preguntas en cualquiera de las 16 categorías.
3. Usa los botones **Importar CSV / JSON** y **Exportar CSV / JSON** para cargar baterías de preguntas de nuevos cursos sin tocar el código fuente.

---

## 17. Cómo Administrar a los Participantes (Panel Docente)

Durante la partida, el profesor dispone del botón **Panel Docente** en la barra superior con control total para:
- Pausar o reanudar la partida.
- Forzar el cambio de turno.
- Mover manualmente la ficha de cualquier equipo a cualquier casilla (`1..48`).
- Ajustar puntuaciones (`+10`, `+25`, `-10`).
- Saltar o repetir una pregunta, o lanzar manualmente una pregunta concreta del banco.
- Reasignar participantes de equipo o expulsar conexiones inactivas.
- Activar el **Modo Proyección** para ocultar los controles administrativos en el proyector del aula.

---

## 18. Cómo Añadir Nuevos Modelos 3D (GLB / Procedurales)

- Para añadir modelos `.glb` optimizados (Draco/Meshopt), colócalos en `apps/web/public/models/` (o en tu bucket Cloudflare R2) y cárgalos con `useGLTF('/models/tu_modelo.glb')` de `@react-three/drei` dentro de `apps/web/src/board/IndustrialZones3D.tsx`.
- Registra siempre el autor y la licencia compatible en [ASSETS_LICENSES.md](./ASSETS_LICENSES.md).

---

## 19. Cómo Añadir Efectos de Sonido y Música

El motor de audio se encuentra en `apps/web/src/audio/SoundEngine.ts`. Puedes añadir nuevos patrones melódicos en `startThemeLoop()` o nuevos efectos sintetizados en `playSfx()`, así como su subtítulo accesible correspondiente en `CAPTION_LABELS`.

---

## 20. Solución de Problemas Habituales (Troubleshooting)

- **No se escucha música al abrir la página:** Los navegadores bloquean el audio automático hasta el primer clic o toque en pantalla. Al pulsar cualquier botón de la interfaz, `soundEngine.unlockAudio()` activa automáticamente el contexto de audio.
- **Dispositivo móvil antiguo con pocos FPS:** Abre el icono de **Configuración (⚙️)** en la barra superior y selecciona Calidad Gráfica **BAJA** o activa el **Tablero Simplificado 2D**.
- **Los participantes ven "Sincronización Multi-Pestaña" en lugar de "Servidor Cloudflare":** Verifica que `VITE_WS_URL` apunta a tu Worker activo (`wss://...`) y que has ejecutado `npx wrangler deploy`.
