# Guía Paso a Paso de Despliegue en Cloudflare
## PRL-OCA 3D ONLINE (Cloudflare Pages + Workers + Durable Objects + D1)

Esta guía detalla todos los pasos necesarios para publicar **PRL-OCA 3D ONLINE** en producción utilizando la infraestructura global de Cloudflare conectada con GitHub.

---

## 1. Preparación de la Cuenta y Wrangler CLI

1. Asegúrate de tener una cuenta activa en [Cloudflare](https://dash.cloudflare.com/) con el plan de Workers que soporte **Durable Objects** (Workers Paid para Durable Objects en producción, o entorno local gratuito con `wrangler dev`).
2. Desde la raíz del repositorio, inicia sesión en Cloudflare:
   ```bash
   npx wrangler login
   ```
3. Comprueba tu identidad de cuenta:
   ```bash
   npx wrangler whoami
   ```

---

## 2. Creación y Migración de la Base de Datos Cloudflare D1

1. Ejecuta el comando para crear la base de datos SQLite serverless en Cloudflare D1:
   ```bash
   npx wrangler d1 create prl-oca-db
   ```
2. La terminal mostrará un bloque similar a este:
   ```json
   {
     "binding": "DB",
     "database_name": "prl-oca-db",
     "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   }
   ```
3. Abre el archivo [apps/realtime/wrangler.jsonc](./apps/realtime/wrangler.jsonc) y reemplaza `REPLACE_WITH_YOUR_CLOUDFLARE_D1_DATABASE_ID` por el identificador real devuelto.
4. Ejecuta la migración SQL inicial en remoto:
   ```bash
   cd apps/realtime
   npx wrangler d1 migrations apply prl-oca-db --remote
   ```

---

## 3. Despliegue del Backend Multijugador (`prl-oca-realtime`)

El backend incluye el Worker principal y la clase Durable Object `GameRoom` configurada con migración SQLite (`new_sqlite_classes: ["GameRoom"]`).

### Opción A (Recomendada): Workers Builds conectado a GitHub
1. Entra en **Cloudflare Dashboard** → **Workers & Pages** → **Create** → **Workers** → **Import a repository**.
2. Selecciona tu repositorio GitHub `prl-oca-3d`.
3. Configura:
   - **Nombre del proyecto:** `prl-oca-realtime`
   - **Directorio raíz (Root directory):** `apps/realtime`
   - **Comando de compilación (Build command):** `npm run build`
   - **Comando de despliegue (Deploy command):** `npx wrangler deploy`

### Opción B: Despliegue directo desde CLI
```bash
cd apps/realtime
npx wrangler deploy --env production
```

Al finalizar, Cloudflare te proporcionará la URL pública del Worker, por ejemplo:
`https://prl-oca-realtime.<tu-subdominio>.workers.dev`

Puedes verificar que responde correctamente abriendo en tu navegador:
`https://prl-oca-realtime.<tu-subdominio>.workers.dev/api/health`

---

## 4. Despliegue del Frontend 3D en Cloudflare Pages

1. Entra en **Cloudflare Dashboard** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Selecciona el repositorio GitHub `prl-oca-3d`.
3. Configura los parámetros de compilación de **Cloudflare Pages**:
   - **Project name:** `prl-oca-3d`
   - **Production branch:** `main`
   - **Preview branches:** `development`
   - **Root directory:** `/` (raíz del monorepositorio)
   - **Build command:** `npm run build:web`
   - **Build output directory:** `apps/web/dist`
4. En la sección **Environment variables (Production & Preview)** añade:
   ```text
   VITE_API_URL = https://prl-oca-realtime.<tu-subdominio>.workers.dev
   VITE_WS_URL  = wss://prl-oca-realtime.<tu-subdominio>.workers.dev
   NODE_VERSION = 22
   ```
5. Pulsa **Save and Deploy**.

> **Rutas SPA y Cabeceras de Seguridad:**
> El directorio `apps/web/public/` incluye los archivos `_redirects` (`/* /index.html 200`) y `_headers` que Cloudflare Pages detecta automáticamente para garantizar la navegación SPA y las cabeceras de seguridad HTTP.

---

## 5. Configuración de CORS en Producción

Una vez tengas el dominio definitivo de Cloudflare Pages (por ejemplo `https://prl-oca-3d.pages.dev` o tu dominio personalizado), verifica en `apps/realtime/wrangler.jsonc` bajo `env.production.vars`:

```jsonc
"ALLOWED_ORIGIN": "https://prl-oca-3d.pages.dev"
```

---

## 6. Evitar Despliegues Duplicados (GitHub vs. Cloudflare Nativo)

- El archivo `.github/workflows/ci.yml` ejecuta **únicamente pruebas y verificación de compilación** en cada push o pull request.
- El archivo `.github/workflows/deploy.yml` está configurado con `on: workflow_dispatch` (ejecución manual bajo demanda) para que no colisione con el despliegue automático nativo de Cloudflare Pages y Workers Builds.
