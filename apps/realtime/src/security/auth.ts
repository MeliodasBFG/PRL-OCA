/**
 * Security utilities: short-lived teacher tokens, rate limiting, and production CORS/Origin checks.
 */

export interface TeacherTokenPayload {
  roomCode: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours session TTL

export function createTeacherToken(
  roomCode: string,
  secretPin: string,
  serverSecret = ''
): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const raw = `${roomCode.toUpperCase()}:${issuedAt}:${expiresAt}`;
  const sig = simpleHash(`${raw}:${secretPin}:${serverSecret}`);
  return `${raw}:${sig}`;
}

export function verifyTeacherToken(
  token: string | undefined,
  roomCode: string,
  secretPin: string,
  serverSecret = ''
): boolean {
  if (!token) return false;
  // Local fallback compatibility when room uses direct PIN matching without server secret
  if (!serverSecret && token === secretPin) return true;
  const parts = token.split(':');
  if (parts.length !== 4) return false;
  const [tRoom, issuedStr, expiresStr, sig] = parts;
  if (tRoom !== roomCode.toUpperCase()) return false;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expectedSig = simpleHash(`${tRoom}:${issuedStr}:${expiresStr}:${secretPin}:${serverSecret}`);
  return sig === expectedSig;
}

function simpleHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch: number; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export class RateLimiter {
  private buckets = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly maxRequestsPerWindow = 40,
    private readonly windowMs = 5000
  ) {}

  public allow(key: string): boolean {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || now - existing.windowStart > this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (existing.count >= this.maxRequestsPerWindow) {
      return false;
    }
    existing.count += 1;
    return true;
  }
}

function matchesOriginPattern(origin: string, pattern: string): boolean {
  if (pattern === '*') return true;
  const cleanPattern = pattern.trim().replace(/\/$/, '');
  const cleanOrigin = origin.trim().replace(/\/$/, '');
  if (!cleanPattern || !cleanOrigin) return false;
  if (cleanOrigin === cleanPattern) return true;

  // Support subdomain wildcards such as https://*.prl-oca-3d.pages.dev or https://*.pages.dev
  if (cleanPattern.includes('*.')) {
    try {
      const originUrl = new URL(cleanOrigin);
      const wildcardPrefix = cleanPattern.split('*.')[0];
      const wildcardSuffix = cleanPattern.slice(wildcardPrefix.length + 2);
      if (!cleanPattern.startsWith(`${originUrl.protocol}//`)) return false;
      const host = originUrl.hostname.toLowerCase();
      const targetSuffix = wildcardSuffix.toLowerCase();
      return host === targetSuffix || host.endsWith(`.${targetSuffix}`);
    } catch {
      return false;
    }
  }
  return false;
}

export function isOriginAllowed(
  requestOrigin: string | null,
  configuredOrigin = '*',
  environment = 'development'
): boolean {
  if (!requestOrigin) return true;
  if (configuredOrigin.trim() === '*') return true;

  // Always allow localhost / 127.0.0.1 in non-production environments
  if (environment !== 'production') {
    try {
      const url = new URL(requestOrigin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      return false;
    }
  }

  const patterns = configuredOrigin
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return patterns.some((p) => matchesOriginPattern(requestOrigin, p));
}

export function buildCorsHeaders(
  configuredOrigin = '*',
  requestOrigin: string | null = null,
  environment = 'development'
): Record<string, string> {
  let allowHeader = '*';
  if (configuredOrigin.trim() !== '*') {
    const patterns = configuredOrigin
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (requestOrigin && isOriginAllowed(requestOrigin, configuredOrigin, environment)) {
      allowHeader = requestOrigin;
    } else {
      allowHeader = patterns[0] ?? 'https://prl-oca-3d.pages.dev';
    }
  }

  return {
    'Access-Control-Allow-Origin': allowHeader,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Teacher-Token, X-Teacher-Secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
