import {
  CreateRoomRequestSchema,
  QuestionItemSchema,
} from '@prl-oca/shared';
import { Env, GameRoom } from './durable-objects/GameRoom';
import { buildCorsHeaders, isOriginAllowed } from './security/auth';
import { DatabaseService } from './services/db';

export { GameRoom };

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PRL';
  for (let i = 0; i < 3; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

    // Create a new Game Room -> POST /api/rooms
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const rawBody = await request.json().catch(() => ({}));
      const parsed = CreateRoomRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Datos de configuración inválidos.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

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

      const data = await initRes.text();
      return new Response(data, {
        status: initRes.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Query existing Game Room state -> GET /api/rooms/:code
    const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]+)$/);
    if (request.method === 'GET' && roomMatch) {
      const roomCode = roomMatch[1].toUpperCase();
      const id = env.GAME_ROOMS.idFromName(roomCode);
      const stub = env.GAME_ROOMS.get(id);
      const res = await stub.fetch(new Request(`https://internal/state?roomCode=${roomCode}`));
      const data = await res.text();
      return new Response(data, {
        status: res.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // WebSocket connection -> /ws/:code
    const wsMatch = url.pathname.match(/^\/ws\/([A-Za-z0-9_-]+)$/);
    if (wsMatch) {
      const roomCode = wsMatch[1].toUpperCase();
      const id = env.GAME_ROOMS.idFromName(roomCode);
      const stub = env.GAME_ROOMS.get(id);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('roomCode', roomCode);
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
