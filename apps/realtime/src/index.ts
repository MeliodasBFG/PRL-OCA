import {
  CreateRoomRequestSchema,
  QuestionItemSchema,
  isValidRoomCodeFormat,
  normalizeRoomCode,
} from '@prl-oca/shared';
import { Env, GameRoom } from './durable-objects/GameRoom';
import { RateLimiter, buildCorsHeaders, isOriginAllowed } from './security/auth';
import { DatabaseService } from './services/db';

export { GameRoom };

const createRoomLimiter = new RateLimiter(25, 60_000);

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PRL';
  for (let i = 0; i < 3; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function workerJsonError(
  status: number,
  error: string,
  message: string,
  cors: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      ok: false,
      error,
      message,
    }),
    { status, headers: { ...cors, 'Content-Type': 'application/json' } }
  );
}

function safeDecodeAndValidateRoomCode(
  rawSegment: string
): { ok: true; roomCode: string } | { ok: false; error: 'INVALID_ROOM_CODE'; message: string } {
  let decoded = rawSegment;
  try {
    decoded = decodeURIComponent(rawSegment);
  } catch {
    return {
      ok: false,
      error: 'INVALID_ROOM_CODE',
      message: 'Formato de código de sala incorrecto.',
    };
  }
  const normalized = normalizeRoomCode(decoded);
  if (!isValidRoomCodeFormat(normalized)) {
    return {
      ok: false,
      error: 'INVALID_ROOM_CODE',
      message: 'Formato de código de sala incorrecto.',
    };
  }
  return { ok: true, roomCode: normalized };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get('Origin');
    const cors = buildCorsHeaders(
      env.ALLOWED_ORIGIN ?? '*',
      requestOrigin,
      env.ENVIRONMENT ?? 'development'
    );

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (
      requestOrigin &&
      !isOriginAllowed(requestOrigin, env.ALLOWED_ORIGIN ?? '*', env.ENVIRONMENT ?? 'development')
    ) {
      return new Response(JSON.stringify({ ok: false, error: 'Origen no permitido por CORS.' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const db = new DatabaseService(env.DB);

    // Health check
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'prl-oca-realtime',
          environment: env.ENVIRONMENT ?? 'development',
          timestamp: Date.now(),
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Create a new Game Room -> POST /api/rooms (EXCLUSIVE creation path)
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const clientIp = request.headers.get('CF-Connecting-IP') ?? 'local';
      if (!createRoomLimiter.allow(`create:${clientIp}`)) {
        return workerJsonError(
          429,
          'RATE_LIMITED',
          'Has creado demasiadas salas en poco tiempo. Espera un minuto.',
          cors
        );
      }

      if (env.TEACHER_CREATE_SECRET) {
        const providedSecret =
          request.headers.get('X-Teacher-Secret')?.trim() ||
          request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
        if (providedSecret !== env.TEACHER_CREATE_SECRET) {
          return workerJsonError(
            401,
            'TEACHER_AUTH_REQUIRED',
            'Credencial requerida para crear nuevas salas.',
            cors
          );
        }
      }

      const rawBody = await request.json().catch(() => ({}));
      const parsed = CreateRoomRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        return workerJsonError(
          400,
          'INVALID_CONFIG',
          'Datos de configuración inválidos.',
          cors
        );
      }

      let lastStatus = 500;
      let lastData = '';
      for (let attempt = 0; attempt < 8; attempt++) {
        const roomCode = generateRoomCode();
        const id = env.GAME_ROOMS.idFromName(roomCode);
        const stub = env.GAME_ROOMS.get(id);

        const initRes = await stub.fetch(
          new Request(`https://internal/init?roomCode=${roomCode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomCode,
              config: parsed.data.config,
              teacherPin: parsed.data.teacherPin,
            }),
          })
        );

        lastStatus = initRes.status;
        lastData = await initRes.text();
        if (initRes.status !== 409) {
          console.log(`[Worker] Created room roomCode=${roomCode}`);
          return new Response(lastData, {
            status: lastStatus,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
      }

      return workerJsonError(
        503,
        'ROOM_CODE_EXHAUSTED',
        'No se pudo asignar un código de sala libre. Inténtalo de nuevo.',
        cors
      );
    }

    // Query existing Game Room state -> GET /api/rooms/:code (NEVER creates a room)
    const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (request.method === 'GET' && roomMatch) {
      const check = safeDecodeAndValidateRoomCode(roomMatch[1]);
      if (!check.ok) {
        return workerJsonError(400, check.error, check.message, cors);
      }
      const id = env.GAME_ROOMS.idFromName(check.roomCode);
      const stub = env.GAME_ROOMS.get(id);
      const res = await stub.fetch(new Request(`https://internal/state?roomCode=${check.roomCode}`));
      const data = await res.text();
      return new Response(data, {
        status: res.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Authoritative room join validation -> POST /api/rooms/:code/join (NEVER creates a room)
    const joinMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
    if (request.method === 'POST' && joinMatch) {
      const check = safeDecodeAndValidateRoomCode(joinMatch[1]);
      if (!check.ok) {
        return workerJsonError(400, check.error, check.message, cors);
      }
      const id = env.GAME_ROOMS.idFromName(check.roomCode);
      const stub = env.GAME_ROOMS.get(id);
      const rawBody = await request.text();
      console.log(`[Worker] Validating /join roomCode=${check.roomCode}`);
      const res = await stub.fetch(
        new Request(`https://internal/join?roomCode=${check.roomCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: rawBody,
        })
      );
      const data = await res.text();
      return new Response(data, {
        status: res.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Authoritative HTTP fallback for Teacher Commands -> POST /api/rooms/:code/teacher-action
    const teacherActionMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(?:teacher-action|start)$/);
    if (request.method === 'POST' && teacherActionMatch) {
      const check = safeDecodeAndValidateRoomCode(teacherActionMatch[1]);
      if (!check.ok) {
        return workerJsonError(400, check.error, check.message, cors);
      }
      const id = env.GAME_ROOMS.idFromName(check.roomCode);
      const stub = env.GAME_ROOMS.get(id);
      const rawBody = await request.text();
      console.log(`[Worker] Forwarding HTTP teacher-action roomCode=${check.roomCode}`);
      const res = await stub.fetch(
        new Request(`https://internal/teacher-action?roomCode=${check.roomCode}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Teacher-Token': request.headers.get('X-Teacher-Token') ?? '',
          },
          body: rawBody,
        })
      );
      const data = await res.text();
      return new Response(data, {
        status: res.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // WebSocket connection -> /ws/:code (DO strictly verifies room existence BEFORE WebSocketPair upgrade)
    const wsMatch = url.pathname.match(/^\/ws\/([^/]+)$/);
    if (wsMatch) {
      const check = safeDecodeAndValidateRoomCode(wsMatch[1]);
      if (!check.ok) {
        return workerJsonError(400, check.error, check.message, cors);
      }
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return workerJsonError(426, 'UPGRADE_REQUIRED', 'Se requiere conexión WebSocket.', cors);
      }
      const id = env.GAME_ROOMS.idFromName(check.roomCode);
      const stub = env.GAME_ROOMS.get(id);
      console.log(`[Worker] Routing WebSocket upgrade roomCode=${check.roomCode}`);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('roomCode', check.roomCode);
      return stub.fetch(new Request(forwardUrl.toString(), request));
    }

    // Question Bank API -> GET / POST /api/questions
    if (url.pathname === '/api/questions') {
      if (request.method === 'GET') {
        const questions = await db.getQuestions();
        return new Response(JSON.stringify({ ok: true, questions }), {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      if (request.method === 'POST') {
        if (env.TEACHER_ADMIN_SECRET) {
          const authHeader = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
          const secretHeader = request.headers.get('X-Teacher-Secret')?.trim();
          if (authHeader !== env.TEACHER_ADMIN_SECRET && secretHeader !== env.TEACHER_ADMIN_SECRET) {
            return new Response(
              JSON.stringify({ ok: false, error: 'Credencial administrativa requerida.' }),
              { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
            );
          }
        }
        const raw = await request.json().catch(() => ({}));
        const parsed = QuestionItemSchema.safeParse(raw);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Pregunta no válida.', details: parsed.error.issues }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          );
        }
        await db.saveQuestion(parsed.data);
        return new Response(JSON.stringify({ ok: true, question: parsed.data }), {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // Match History API -> GET /api/history
    if (request.method === 'GET' && url.pathname === '/api/history') {
      const history = await db.getMatchHistory();
      return new Response(JSON.stringify({ ok: true, history }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ ok: false, error: 'Endpoint no encontrado en prl-oca-realtime' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  },
};
