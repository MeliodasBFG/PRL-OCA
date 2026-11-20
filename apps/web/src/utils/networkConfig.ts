/**
 * Network URL resolution & production HTTPS/WSS normalization helpers.
 * Guarantees secure `https://` and `wss://` endpoints when hosted on Cloudflare Pages
 * or any HTTPS custom domain, while supporting localhost during local development.
 */

export interface NetworkEnvConfig {
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
  VITE_ENABLE_LOCAL_FALLBACK?: string;
  PROD?: boolean;
  DEV?: boolean;
}

export interface BrowserLocationLike {
  protocol: string;
  hostname: string;
}

function getDefaultEnv(): NetworkEnvConfig {
  const metaEnv = (import.meta as { env?: NetworkEnvConfig }).env;
  return metaEnv ?? {};
}

function getBrowserLocation(locOverride?: BrowserLocationLike): BrowserLocationLike {
  if (locOverride) return locOverride;
  if (typeof window !== 'undefined' && window.location) {
    return {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    };
  }
  return { protocol: 'http:', hostname: 'localhost' };
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  );
}

export function isProductionEnvironment(
  envOverride?: NetworkEnvConfig,
  locationOverride?: BrowserLocationLike
): boolean {
  const loc = getBrowserLocation(locationOverride);
  if (loc.hostname && !isLocalHostname(loc.hostname)) {
    return true;
  }
  const env = envOverride ?? getDefaultEnv();
  return env.PROD === true && !isLocalHostname(loc.hostname);
}

export function isLocalFallbackEnabled(
  envOverride?: NetworkEnvConfig,
  locationOverride?: BrowserLocationLike
): boolean {
  const env = envOverride ?? getDefaultEnv();
  // Never enable local simulation fallback in production origins (pages.dev / custom HTTPS domains)
  if (isProductionEnvironment(env, locationOverride)) {
    return false;
  }
  return String(env.VITE_ENABLE_LOCAL_FALLBACK ?? 'true').trim().toLowerCase() !== 'false';
}

function stripEnvValue(raw?: string): string {
  return (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '');
}

export function hasConfiguredApiEnv(envOverride?: NetworkEnvConfig): boolean {
  const env = envOverride ?? getDefaultEnv();
  return Boolean(stripEnvValue(env.VITE_API_URL) || stripEnvValue(env.VITE_WS_URL));
}

export function resolveApiBaseUrl(
  envOverride?: NetworkEnvConfig,
  locationOverride?: BrowserLocationLike
): string | null {
  const env = envOverride ?? getDefaultEnv();
  const loc = getBrowserLocation(locationOverride);
  const isHttps = loc.protocol === 'https:';
  const configuredApi = stripEnvValue(env.VITE_API_URL);
  const configuredWs = stripEnvValue(env.VITE_WS_URL);

  let rawBase = configuredApi || configuredWs;

  if (!rawBase) {
    return isLocalHostname(loc.hostname) ? 'http://localhost:8787' : null;
  }

  rawBase = rawBase
    .replace(/^wss:\/\//i, 'https://')
    .replace(/^ws:\/\//i, 'http://');

  const withScheme = /^https?:\/\//i.test(rawBase)
    ? rawBase
    : `${isHttps ? 'https' : 'http'}://${rawBase}`;

  try {
    const parsed = new URL(withScheme);
    if (isHttps && parsed.protocol === 'http:' && !isLocalHostname(parsed.hostname)) {
      parsed.protocol = 'https:';
    }
    const cleanPath = parsed.pathname
      .replace(/\/+(api(\/rooms)?|ws)\/?$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return withScheme.replace(/\/+$/, '');
  }
}

export function formatServerHttpDiagnostic(params: {
  status: number;
  errorCode?: string;
  serverMessage?: string;
  targetUrl: string;
  origin?: string;
}): string {
  const { status, errorCode, serverMessage, targetUrl, origin } = params;
  const code = (errorCode ?? '').toUpperCase();
  const detail = serverMessage?.trim() || `HTTP ${status}`;

  console.error('[PRL-OCA][HTTP]', { status, errorCode: code || undefined, targetUrl, origin, detail });

  if (code === 'DURABLE_OBJECT_BINDING_MISSING' || code === 'DURABLE_OBJECT_ERROR') {
    return `Error de Durable Objects en Cloudflare Workers (HTTP ${status}): ${detail}`;
  }
  if (code === 'DATABASE_ERROR') {
    return `Error de base de datos D1 en Cloudflare Workers (HTTP ${status}): ${detail}`;
  }
  if (code === 'CORS_ORIGIN_FORBIDDEN' || (status === 403 && code.includes('CORS'))) {
    return `Bloqueo CORS en Cloudflare Workers (HTTP 403): el origen "${origin ?? 'desconocido'}" no está autorizado en ALLOWED_ORIGIN.`;
  }
  if (code === 'UNAUTHORIZED_PLAYER') {
    return `Sesión de jugador no autorizada (UNAUTHORIZED_PLAYER · HTTP ${status}): ${detail}`;
  }
  if (code === 'INVALID_PLAYER_TOKEN') {
    return `Credencial de jugador inválida o caducada (INVALID_PLAYER_TOKEN · HTTP ${status}): ${detail}`;
  }
  if (code === 'PLAYER_NOT_FOUND') {
    return `Jugador no encontrado en la sala (PLAYER_NOT_FOUND · HTTP ${status}): ${detail}`;
  }
  if (code === 'NOT_YOUR_TURN') {
    return `Turno no válido (NOT_YOUR_TURN · HTTP ${status}): ${detail}`;
  }

  switch (status) {
    case 400:
      return `Petición o configuración inválida (HTTP 400): ${detail}`;
    case 401:
      return `Autenticación requerida o token inválido (HTTP 401): ${detail}`;
    case 403:
      return `Acceso o acción denegada por Cloudflare Workers (HTTP 403): ${detail}`;
    case 404:
      if (code === 'ROOM_NOT_FOUND') {
        return detail;
      }
      return `Recurso o endpoint no encontrado en Cloudflare Workers (HTTP 404 en ${targetUrl}): ${detail}`;
    case 409:
      return `Conflicto de estado o turno en la sala (HTTP 409): ${detail}`;
    case 429:
      return `Límite temporal de peticiones alcanzado (HTTP 429): ${detail}`;
    default:
      if (status >= 500) {
        return `Error interno del servidor Cloudflare Workers (HTTP ${status}): ${detail}`;
      }
      return `Error del servidor Cloudflare Workers (HTTP ${status}): ${detail}`;
  }
}

export async function diagnoseFetchConnectionFailure(params: {
  error: unknown;
  apiBase: string;
  targetUrl: string;
  actionLabel: string;
}): Promise<string> {
  const { error, apiBase, targetUrl, actionLabel } = params;
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : 'desconocido';
  const errName = error instanceof Error ? error.name : 'UnknownError';
  const errMsg = error instanceof Error ? error.message : String(error);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  console.error(`[PRL-OCA][Network] Error al ${actionLabel}`, {
    targetUrl,
    origin,
    offline,
    errName,
    errMsg,
  });

  if (errName === 'AbortError') {
    return `Tiempo de espera agotado (Timeout) al ${actionLabel} con Cloudflare Workers (${targetUrl}). Revisa tu red e inténtalo de nuevo.`;
  }
  if (offline) {
    return `Error de conexión: sin acceso a internet en tu navegador al ${actionLabel}.`;
  }

  try {
    const parsedApi = new URL(apiBase);
    if (isLocalHostname(parsedApi.hostname)) {
      return `Error de conexión con el Worker local en ${apiBase} (${errMsg}).`;
    }
  } catch {
    return `URL del backend inválida en VITE_API_URL ("${apiBase}").`;
  }

  // Probe GET /api/health to distinguish CORS preflight rejection on action endpoints vs unreachable Worker
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const healthRes = await fetch(`${apiBase}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (healthRes.ok) {
      return `Error CORS / preflight OPTIONS bloqueado al ${actionLabel} desde "${origin}" hacia ${apiBase}. Verifica ALLOWED_ORIGIN y Access-Control-Allow-Headers en Cloudflare Workers.`;
    }
  } catch {
    // Both target endpoint and /api/health failed -> connection, DNS, TLS, or CORS origin block
  }

  return `Error de conexión con Cloudflare Workers (${apiBase}) al ${actionLabel} desde "${origin}". Causa técnica: ${errMsg}.`;
}

function normalizeWebSocketEndpoint(
  rawBase: string,
  cleanCode: string,
  isHttps: boolean
): string {
  let normalized = rawBase.replace(/\/$/, '');
  if (/^https:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^https:\/\//i, 'wss://');
  } else if (/^http:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^http:\/\//i, 'ws://');
  } else if (!/^wss?:\/\//i.test(normalized)) {
    normalized = `${isHttps ? 'wss' : 'ws'}://${normalized}`;
  }

  try {
    const parsed = new URL(normalized);
    // Enforce secure WSS whenever the frontend is loaded over HTTPS (e.g. Cloudflare Pages *.pages.dev)
    if (isHttps && parsed.protocol === 'ws:' && !isLocalHostname(parsed.hostname)) {
      parsed.protocol = 'wss:';
    }
    const cleanPath = parsed.pathname
      .replace(/\/+(api(\/rooms)?|ws)\/?$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.origin.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')}${cleanPath}/ws/${cleanCode}`;
  } catch {
    return `${normalized}/ws/${cleanCode}`;
  }
}

export function resolveWebSocketCandidateUrls(
  roomCode: string,
  envOverride?: NetworkEnvConfig,
  locationOverride?: BrowserLocationLike
): string[] {
  const env = envOverride ?? getDefaultEnv();
  const loc = getBrowserLocation(locationOverride);
  const isHttps = loc.protocol === 'https:';
  const configuredWs = stripEnvValue(env.VITE_WS_URL);
  const configuredApi = stripEnvValue(env.VITE_API_URL);
  const cleanCode = roomCode.trim().toUpperCase();

  const candidates: string[] = [];
  if (configuredWs) {
    candidates.push(normalizeWebSocketEndpoint(configuredWs, cleanCode, isHttps));
  }
  if (configuredApi) {
    const apiWs = normalizeWebSocketEndpoint(configuredApi, cleanCode, isHttps);
    if (!candidates.includes(apiWs)) {
      candidates.push(apiWs);
    }
  }
  if (candidates.length === 0 && isLocalHostname(loc.hostname)) {
    candidates.push(`ws://localhost:8787/ws/${cleanCode}`);
  }
  return candidates;
}

export function resolveWebSocketUrl(
  roomCode: string,
  envOverride?: NetworkEnvConfig,
  locationOverride?: BrowserLocationLike
): string | null {
  return resolveWebSocketCandidateUrls(roomCode, envOverride, locationOverride)[0] ?? null;
}
