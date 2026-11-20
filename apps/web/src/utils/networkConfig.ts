/**
 * Network URL resolution & production HTTPS/WSS normalization helpers.
 * Guarantees secure `https://` and `wss://` endpoints when hosted on Cloudflare Pages
 * or any HTTPS custom domain, while supporting localhost during local development.
 */

export interface NetworkEnvConfig {
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
  VITE_ENABLE_LOCAL_FALLBACK?: string;
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

export function isLocalFallbackEnabled(envOverride?: NetworkEnvConfig): boolean {
  const env = envOverride ?? getDefaultEnv();
  return String(env.VITE_ENABLE_LOCAL_FALLBACK ?? 'true').trim().toLowerCase() !== 'false';
}

export function resolveApiBaseUrl(
  envOverride?: NetworkEnvConfig,
  locationOverride?: BrowserLocationLike
): string | null {
  const env = envOverride ?? getDefaultEnv();
  const loc = getBrowserLocation(locationOverride);
  const isHttps = loc.protocol === 'https:';
  const configuredApi = env.VITE_API_URL?.trim();
  const configuredWs = env.VITE_WS_URL?.trim();

  let rawBase = configuredApi;
  if (!rawBase && configuredWs) {
    rawBase = configuredWs
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://');
  }

  if (!rawBase) {
    return isLocalHostname(loc.hostname) ? 'http://localhost:8787' : null;
  }

  const withScheme = /^https?:\/\//i.test(rawBase)
    ? rawBase
    : `${isHttps ? 'https' : 'http'}://${rawBase}`;

  try {
    const parsed = new URL(withScheme);
    if (isHttps && parsed.protocol === 'http:' && !isLocalHostname(parsed.hostname)) {
      parsed.protocol = 'https:';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return withScheme.replace(/\/$/, '');
  }
}

export function resolveWebSocketUrl(
  roomCode: string,
  envOverride?: NetworkEnvConfig,
  locationOverride?: BrowserLocationLike
): string | null {
  const env = envOverride ?? getDefaultEnv();
  const loc = getBrowserLocation(locationOverride);
  const isHttps = loc.protocol === 'https:';
  const configuredWs = env.VITE_WS_URL?.trim();
  const configuredApi = env.VITE_API_URL?.trim();

  let rawBase = configuredWs || configuredApi;
  if (!rawBase) {
    if (!isLocalHostname(loc.hostname)) return null;
    rawBase = 'ws://localhost:8787';
  }

  let normalized = rawBase.replace(/\/$/, '');
  if (/^https:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^https:\/\//i, 'wss://');
  } else if (/^http:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^http:\/\//i, 'ws://');
  } else if (!/^wss?:\/\//i.test(normalized)) {
    normalized = `${isHttps ? 'wss' : 'ws'}://${normalized}`;
  }

  const cleanCode = roomCode.trim().toUpperCase();
  try {
    const parsed = new URL(normalized);
    // Enforce secure WSS whenever the frontend is loaded over HTTPS (e.g. Cloudflare Pages *.pages.dev)
    if (isHttps && parsed.protocol === 'ws:' && !isLocalHostname(parsed.hostname)) {
      parsed.protocol = 'wss:';
    }
    return `${parsed.toString().replace(/\/$/, '')}/ws/${cleanCode}`;
  } catch {
    return `${normalized}/ws/${cleanCode}`;
  }
}
