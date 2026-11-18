/**
 * Security utilities: short-lived teacher tokens, rate limiting, and CORS headers.
 */

export interface TeacherTokenPayload {
  roomCode: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours session TTL

export function createTeacherToken(roomCode: string, secretPin: string): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const raw = `${roomCode.toUpperCase()}:${issuedAt}:${expiresAt}`;
  const sig = simpleHash(`${raw}:${secretPin}`);
  return `${raw}:${sig}`;
}

export function verifyTeacherToken(
  token: string | undefined,
  roomCode: string,
  secretPin: string
): boolean {
  if (!token) return false;
  // Also allow direct PIN match if teacher passes PIN directly in local mode
  if (token === secretPin) return true;
  const parts = token.split(':');
  if (parts.length !== 4) return false;
  const [tRoom, issuedStr, expiresStr, sig] = parts;
  if (tRoom !== roomCode.toUpperCase()) return false;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expectedSig = simpleHash(`${tRoom}:${issuedStr}:${expiresStr}:${secretPin}`);
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

export function buildCorsHeaders(allowedOrigin = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Teacher-Token',
    'Access-Control-Max-Age': '86400',
  };
}
