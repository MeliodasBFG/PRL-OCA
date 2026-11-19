# Guía de Despliegue en Cloudflare (Pages + Workers + GitHub)
## PRL-OCA 3D ONLINE

Esta guía recoge los valores exactos obtenidos del repositorio real para desplegar **PRL-OCA 3D ONLINE** utilizando **GitHub**, **Cloudflare Pages** (frontend 3D React/Vite) y **Cloudflare Workers + Durable Objects + D1** (backend multijugador en tiempo real).

---

## Resumen rápido de arquitectura del monorepositorio

- **Frontend (React + Vite + Three.js):** `apps/web` (paquete `@prl-oca/web`)
- **Backend en tiempo real (Cloudflare Worker):** `apps/realtime` (paquete `@prl-oca/realtime`, nombre del Worker en `wrangler.jsonc`: **`prl-oca-realtime`**)
- **Motor y esquemas compartidos:** `packages/shared` (paquete `@prl-oca/shared`)
- **Migraciones SQL para D1:** `migrations/0001_initial_schema.sql`

> **Importante por ser un monorepositorio (`npm workspaces`):** Tanto `@prl-oca/web` como `@prl-oca/realtime` importan el workspace local `@prl-oca/shared`. Por ello **ambos servicios deben instalar dependencias y ejecutarse desde la raíz `/` del repositorio** (nunca aislando `npm install` dentro de `apps/realtime` ni `apps/web`).

---

## Checklist Exacto de Valores para Cloudflare

### A. Qué carpeta seleccionar en Cloudflare Pages (Root directory)
- **`/`** (raíz del repositorio; déjalo vacío o `/` en el campo *Root directory* de Cloudflare Pages).

### B. Qué comando de compilación introducir en Cloudflare Pages (Build command)
```bash
npm run build:web
```
*(Ejecuta `npm run build --workspace=@prl-oca/shared && npm run build --workspace=@prl-oca/web` definido en `package.json`).*

### C. Qué directorio de salida introducir en Cloudflare Pages (Build output directory)
```text
apps/web/dist
```
*(Vite incluye automáticamente `apps/web/public/_redirects` y `apps/web/public/_headers` dentro de `apps/web/dist`).*

---

### D. Qué carpeta seleccionar para Cloudflare Workers
- En **Cloudflare Workers Builds** (conexión directa a GitHub): selecciona **`/`** (raíz del repositorio) como directorio de compilación (*Path / Root directory*) para que `npm install` resuelva `@prl-oca/shared` y el `package-lock.json` raíz.
- *(El código y configuración del Worker residen en `apps/realtime/src/index.ts` y `apps/realtime/wrangler.jsonc`).*

### E. Qué comando de construcción introducir para Cloudflare Workers (Build command)
```bash
npm run build:realtime
```
*(Valida los tipos TypeScript de `@prl-oca/shared` y `@prl-oca/realtime`).*

### F. Qué comando de despliegue introducir para Cloudflare Workers (Deploy command)
```bash
npx wrangler deploy --config apps/realtime/wrangler.jsonc --env production
```
*(O el alias equivalente `npm run deploy:realtime` desde la raíz del repo; para entorno preview usa `--env preview`).*

---

### G. Qué variables de entorno crear en Cloudflare Pages
Configúralas en **Pages → Settings → Environment variables** (tanto en *Production* como en *Preview*, y vuelve a compilar/redesplegar Pages después de añadirlas porque Vite las incrusta en tiempo de compilación):

| Variable | Valor en Producción | Uso real en el código |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://prl-oca-realtime.<tu-subdominio>.workers.dev` *(o tu dominio personalizado HTTPS del Worker)* | Peticiones REST (`POST /api/rooms`, `GET /api/rooms/:code`) en `useGameStore.ts` |
| `VITE_WS_URL` | `wss://prl-oca-realtime.<tu-subdominio>.workers.dev` *(siempre `wss://`)* | WebSocket en tiempo real en `wsClient.ts` (`/ws/:roomCode`). Si por error se pusiera `https://`, `networkConfig.ts` lo normaliza automáticamente a `wss://` en orígenes HTTPS |
| `VITE_ENABLE_LOCAL_FALLBACK` | `false` *(recomendado en producción)* o `true` *(modo demo offline)* | En `false`, muestra error explícito si falla el Worker en lugar de abrir salas locales aisladas |
| `NODE_VERSION` | `22` | Garantiza Node `>=20.0.0` durante la compilación en Pages |
| `VITE_TEACHER_ACCESS_PIN` | *(Opcional)* Clave para abrir el Editor local de Preguntas | Si se deja sin definir, el editor solicita un PIN local de mínimo 4 caracteres (ten en cuenta que cualquier `VITE_*` forma parte del bundle del navegador) |

---

### H. Qué variables y secretos crear en Cloudflare Workers

#### 1. Variables de entorno no secretas (`vars` en `apps/realtime/wrangler.jsonc`)
En `apps/realtime/wrangler.jsonc` (`env.production.vars`):
- `ENVIRONMENT`: `"production"`
- `ALLOWED_ORIGIN`: `"https://prl-oca-3d.pages.dev,https://*.prl-oca-3d.pages.dev"` — **sustitúyelo o amplíalo** con el dominio `.pages.dev` exacto asignado a tu proyecto Pages y tu dominio personalizado si añades uno.

> El módulo `apps/realtime/src/security/auth.ts` valida orígenes múltiples separados por coma y subdominios wildcard de `pages.dev` tanto en peticiones HTTP CORS (`Access-Control-Allow-Origin` + `Vary: Origin`) como en el handshake WebSocket (`403` si un sitio externo no autorizado intenta conectarse en producción).

#### 2. Secretos cifrados (NO los pongas en `wrangler.jsonc` ni en Git)
Créalos en **Cloudflare Dashboard → Workers → `prl-oca-realtime` → Settings → Variables and Secrets** o por CLI desde la raíz:

```bash
npx wrangler secret put TEACHER_TOKEN_SECRET --config apps/realtime/wrangler.jsonc --env production
npx wrangler secret put TEACHER_ADMIN_SECRET --config apps/realtime/wrangler.jsonc --env production
```

| Secreto | Obligatorio | Uso real en el código |
| :--- | :--- | :--- |
| `TEACHER_TOKEN_SECRET` | Recomendado | Firma criptográfica de tokens de sesión de docente emitidos por `GameRoom.ts` (`auth.ts`) |
| `TEACHER_ADMIN_SECRET` | Recomendado | Protege la escritura pública en `POST /api/questions` sobre D1 (`X-Teacher-Secret` o `Authorization: Bearer ...`) |

*(Para pruebas locales con `wrangler dev`, existe la plantilla ignorada por Git en `apps/realtime/.dev.vars.example` → cópiala a `apps/realtime/.dev.vars`).*

---

### I. Qué bases de datos, buckets y recursos crear en Cloudflare

1. **Durable Objects (`GameRoom`) — OBLIGATORIO (se crea automáticamente al desplegar):**
   - Ya configurado en `apps/realtime/wrangler.jsonc`:
     - Binding: `GAME_ROOMS`
     - Clase: `GameRoom` (exportada en `apps/realtime/src/index.ts`)
     - Migración Wrangler: `tag: "v1"`, `new_sqlite_classes: ["GameRoom"]`
   - *Requisito de cuenta:* Cloudflare Workers Paid plan para usar Durable Objects en producción (la mayoría de usos docentes pequeños entran dentro del uso incluido del plan).

2. **Base de datos Cloudflare D1 (`prl-oca-db`) — NECESARIA para persistir banco de preguntas e historial global:**
   - Binding en `wrangler.jsonc`: `DB` (configurado en entorno base, `preview` y `production`), `database_name`: `prl-oca-db`, `migrations_dir`: `../../migrations`.
   - **Pasos obligatorios antes del primer despliegue:**
     1. Inicia sesión en Cloudflare:
        ```bash
        npx wrangler login
        ```
     2. Crea la base de datos:
        ```bash
        npx wrangler d1 create prl-oca-db
        ```
     3. Copia el `database_id` real devuelto por Cloudflare y pégalo en `apps/realtime/wrangler.jsonc` sustituyendo **`REPLACE_WITH_YOUR_CLOUDFLARE_D1_DATABASE_ID`** en los tres bloques (`d1_databases` raíz, `env.preview.d1_databases` y `env.production.d1_databases`).
     4. Aplica la migración SQL inicial (`migrations/0001_initial_schema.sql`) en remoto:
        ```bash
        npx wrangler d1 migrations apply prl-oca-db --config apps/realtime/wrangler.jsonc --env production --remote
        ```
        *(Este comando crea las tablas `questions` y `match_history`).*

3. **Cloudflare R2 (`ASSETS_BUCKET`) — NO ES NECESARIO:**
   - Todos los modelos 3D, materiales, texturas canvas, SVG y sonidos/músicas Web Audio API son **100% procedurales** e incluidos directamente en el frontend (`ASSETS_LICENSES.md`).
   - El código no lee ni requiere actualmente ningún bucket R2; el bloque `r2_buckets` en `apps/realtime/wrangler.jsonc` permanece comentado solo como ampliación futura opcional.

4. **Otros recursos (KV, Queues, Hyperdrive):** No se utilizan.

---

### J. Cómo configurar el dominio y conectar ambos servicios paso a paso

Sigue este orden exacto para conectar Frontend (Pages) ↔ Backend (Worker):

1. **Crea la base de datos D1 y aplica la migración** (Paso I.2), rellenando el `database_id` real en `apps/realtime/wrangler.jsonc` y subiendo el cambio a tu repo GitHub.
2. **Despliega primero el Worker `prl-oca-realtime`** desde Cloudflare Workers Builds (con configuración D, E, F) y añade los secretos `TEACHER_TOKEN_SECRET` y `TEACHER_ADMIN_SECRET`.
3. **Anota la URL HTTPS pública asignada al Worker**, por ejemplo:
   `https://prl-oca-realtime.<tu-subdominio>.workers.dev`
   Comprueba en el navegador que `.../api/health` responde `{"ok":true,...}`.
4. **Crea/configura el proyecto en Cloudflare Pages** conectado al mismo repositorio GitHub (con configuración A, B, C, rama producción `main` y preview `development`), añadiendo las variables del apartado G con la URL real del Worker:
   - `VITE_API_URL` = `https://prl-oca-realtime.<tu-subdominio>.workers.dev`
   - `VITE_WS_URL` = `wss://prl-oca-realtime.<tu-subdominio>.workers.dev`
   - `VITE_ENABLE_LOCAL_FALLBACK` = `false`
5. **Despliega Cloudflare Pages** y anota tu dominio público asignado, por ejemplo:
   `https://<tu-proyecto>.pages.dev`
6. **Ajusta `ALLOWED_ORIGIN` en el Worker (`apps/realtime/wrangler.jsonc` → `env.production.vars`)** con el dominio exacto de tu Cloudflare Pages:
   ```jsonc
   "ALLOWED_ORIGIN": "https://<tu-proyecto>.pages.dev,https://*.<tu-proyecto>.pages.dev"
   ```
   *(Si conectas un dominio propio, por ejemplo `https://juego.tuempresa.com` para Pages y `https://api-juego.tuempresa.com` para el Worker mediante **Custom Domains** en Cloudflare DNS, añade ambos orígenes separados por coma en `ALLOWED_ORIGIN` y actualiza `VITE_API_URL` = `https://api-juego.tuempresa.com` y `VITE_WS_URL` = `wss://api-juego.tuempresa.com` en Pages).*

---

## Notas sobre GitHub y Workflows CI/CD

- **`.github/workflows/ci.yml`:** Ejecuta `npm run typecheck`, `npm test` y `npm run build` en cada `push`/`pull_request` sobre `main` y `development`.
- **`.github/workflows/deploy.yml`:** Workflow **manual** (`workflow_dispatch`) para evitar despliegues duplicados cuando Cloudflare Pages / Workers Builds ya están conectados a GitHub. Si decides usar este workflow manualmente, define en GitHub Settings → Secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) y Variables (`VITE_API_URL`, `VITE_WS_URL`, `VITE_ENABLE_LOCAL_FALLBACK`).
- **Seguridad Git:** `.gitignore` ignora `.env`, `.env.*` (excepto `.env.example`), `.dev.vars`, `.dev.vars.*`, `.wrangler/` y `dist/`. No existe ninguna clave privada ni token dentro del repositorio.
