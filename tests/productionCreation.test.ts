import { describe, expect, it, vi } from 'vitest';
import { GameRoomState, INITIAL_QUESTION_BANK, ServerToClientMessage } from '@prl-oca/shared';
import workerEntry, { GameRoom } from '../apps/realtime/src/index';
import {
  formatServerHttpDiagnostic,
  hasConfiguredApiEnv,
  resolveApiBaseUrl,
  resolveWebSocketUrl,
} from '../apps/web/src/utils/networkConfig';
import { useGameStore } from '../apps/web/src/stores/useGameStore';

const PROD_ALLOWED_ORIGINS =
  'https://prl-oca-3d.pages.dev,https://*.prl-oca-3d.pages.dev,https://prl-oca-3d-online.pages.dev,https://*.prl-oca-3d-online.pages.dev,https://prl-oca.pages.dev,https://*.prl-oca.pages.dev';

class MockSocket {
  public inbox: ServerToClientMessage[] = [];
  private attachment: unknown = undefined;

  public send(payload: string): void {
    this.inbox.push(JSON.parse(payload) as ServerToClientMessage);
  }

  public close(): void {}

  public serializeAttachment(att: unknown): void {
    this.attachment = att;
  }

  public deserializeAttachment(): unknown {
    return this.attachment;
  }

  public messagesOfType<T extends ServerToClientMessage['type']>(
    type: T
  ): Array<Extract<ServerToClientMessage, { type: T }>> {
    return this.inbox.filter((m) => m.type === type) as Array<
      Extract<ServerToClientMessage, { type: T }>
    >;
  }
}

function createProdWorkerEnv() {
  const namespaces = new Map<
    string,
    { storageMap: Map<string, unknown>; sockets: MockSocket[]; instance: GameRoom }
  >();

  const env = {
    ENVIRONMENT: 'production',
    ALLOWED_ORIGIN: PROD_ALLOWED_ORIGINS,
    TEACHER_TOKEN_SECRET: 'prod_token_secret_xyz',
    GAME_ROOMS: {
      idFromName: (name: string) => name as unknown as DurableObjectId,
      get: (id: DurableObjectId) => {
        const key = String(id);
        let rec = namespaces.get(key);
        if (!rec) {
          const storageMap = new Map<string, unknown>();
          const sockets: MockSocket[] = [];
          const ctx = {
            storage: {
              get: async <T>(k: string) => storageMap.get(k) as T | undefined,
              put: async (k: string, val: unknown) => {
                storageMap.set(k, val);
              },
            },
            getWebSockets: () => sockets as unknown as WebSocket[],
          };
          const instance = new GameRoom(ctx as never, {
            GAME_ROOMS: {} as DurableObjectNamespace,
            ENVIRONMENT: 'production',
            ALLOWED_ORIGIN: PROD_ALLOWED_ORIGINS,
            TEACHER_TOKEN_SECRET: 'prod_token_secret_xyz',
          });
          rec = { storageMap, sockets, instance };
          namespaces.set(key, rec);
        }
        return {
          fetch: (req: Request) => rec!.instance.fetch(req),
        } as unknown as DurableObjectStub;
      },
    },
    DB: {
      prepare: () => ({
        bind: () => ({ all: async () => ({ results: [] }), run: async () => ({ success: true }) }),
        all: async () => ({ results: INITIAL_QUESTION_BANK.slice(0, 1) }),
      }),
    },
  };

  return { env, namespaces };
}

describe('Producción Cloudflare Pages <-> Workers: CORS, Diagnóstico y Creación de Salas', () => {
  it('normaliza correctamente VITE_API_URL y VITE_WS_URL evitando errores de esquema o rutas duplicadas', () => {
    const pagesLoc = { protocol: 'https:', hostname: 'prl-oca-3d.pages.dev' };

    expect(
      resolveApiBaseUrl(
        { VITE_API_URL: ' "wss://prl-oca-realtime.cuenta.workers.dev/api/" ' },
        pagesLoc
      )
    ).toBe('https://prl-oca-realtime.cuenta.workers.dev');

    expect(
      resolveWebSocketUrl(
        ' prl123 ',
        { VITE_API_URL: 'https://prl-oca-realtime.cuenta.workers.dev/' },
        pagesLoc
      )
    ).toBe('wss://prl-oca-realtime.cuenta.workers.dev/ws/PRL123');

    expect(hasConfiguredApiEnv({ VITE_API_URL: 'https://prl-oca-realtime.cuenta.workers.dev' })).toBe(
      true
    );
    expect(hasConfiguredApiEnv({})).toBe(false);
  });

  it('permite OPTIONS preflight y POST /api/rooms desde dominios válidos de Pages y rechaza orígenes no autorizados', async () => {
    const { env } = createProdWorkerEnv();

    for (const allowedOrigin of [
      'https://prl-oca-3d.pages.dev',
      'https://development.prl-oca-3d.pages.dev',
      'https://prl-oca-3d-online.pages.dev',
    ]) {
      const preflight = await workerEntry.fetch(
        new Request('https://prl-oca-realtime.cuenta.workers.dev/api/rooms', {
          method: 'OPTIONS',
          headers: {
            Origin: allowedOrigin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type',
          },
        }),
        env as never
      );
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);
      expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    }

    // Origen malicioso -> HTTP 403 CORS_ORIGIN_FORBIDDEN
    const forbiddenRes = await workerEntry.fetch(
      new Request('https://prl-oca-realtime.cuenta.workers.dev/api/rooms', {
        method: 'POST',
        headers: {
          Origin: 'https://sitio-externo-no-autorizado.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teacherPin: 'PIN2026', teacherName: 'Prof' }),
      }),
      env as never
    );
    expect(forbiddenRes.status).toBe(403);
    const errJson = (await forbiddenRes.json()) as { error: string; message: string };
    expect(errJson.error).toBe('CORS_ORIGIN_FORBIDDEN');
    expect(errJson.message).toContain('ALLOWED_ORIGIN');
  });

  it('devuelve JSON con cabeceras CORS ante errores de Durable Objects o falta de bindings', async () => {
    const resMissingBinding = await workerEntry.fetch(
      new Request('https://prl-oca-realtime.cuenta.workers.dev/api/rooms', {
        method: 'POST',
        headers: {
          Origin: 'https://prl-oca-3d.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teacherPin: 'PIN2026', teacherName: 'Prof' }),
      }),
      {
        ENVIRONMENT: 'production',
        ALLOWED_ORIGIN: PROD_ALLOWED_ORIGINS,
      } as never
    );
    expect(resMissingBinding.status).toBe(500);
    expect(resMissingBinding.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://prl-oca-3d.pages.dev'
    );
    const bodyMissing = (await resMissingBinding.json()) as { error: string };
    expect(bodyMissing.error).toBe('DURABLE_OBJECT_BINDING_MISSING');

    // Stub crash devuelve DURABLE_OBJECT_ERROR preservando CORS
    const resStubCrash = await workerEntry.fetch(
      new Request('https://prl-oca-realtime.cuenta.workers.dev/api/rooms', {
        method: 'POST',
        headers: {
          Origin: 'https://prl-oca-3d.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teacherPin: 'PIN2026', teacherName: 'Prof' }),
      }),
      {
        ENVIRONMENT: 'production',
        ALLOWED_ORIGIN: PROD_ALLOWED_ORIGINS,
        GAME_ROOMS: {
          idFromName: (n: string) => n,
          get: () => ({
            fetch: async () => {
              throw new Error('DO storage unavailable');
            },
          }),
        },
      } as never
    );
    expect(resStubCrash.status).toBe(500);
    expect(resStubCrash.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://prl-oca-3d.pages.dev'
    );
    const bodyCrash = (await resStubCrash.json()) as { error: string; message: string };
    expect(bodyCrash.error).toBe('DURABLE_OBJECT_ERROR');
    expect(bodyCrash.message).toContain('DO storage unavailable');
  });

  it('distingue HTTP 400, 401, 403 CORS, 404, 409, 500 DO/D1 y Timeout en el diagnóstico del profesor', async () => {
    expect(
      formatServerHttpDiagnostic({
        status: 400,
        errorCode: 'INVALID_CONFIG',
        serverMessage: 'teacherPin muy corto',
        targetUrl: 'https://worker.test/api/rooms',
      })
    ).toContain('HTTP 400');

    expect(
      formatServerHttpDiagnostic({
        status: 401,
        errorCode: 'TEACHER_AUTH_REQUIRED',
        serverMessage: 'Credencial requerida',
        targetUrl: 'https://worker.test/api/rooms',
      })
    ).toContain('HTTP 401');

    expect(
      formatServerHttpDiagnostic({
        status: 403,
        errorCode: 'CORS_ORIGIN_FORBIDDEN',
        targetUrl: 'https://worker.test/api/rooms',
        origin: 'https://otro.pages.dev',
      })
    ).toContain('Bloqueo CORS');

    expect(
      formatServerHttpDiagnostic({
        status: 404,
        targetUrl: 'https://worker.test/api/rooms',
      })
    ).toContain('HTTP 404');

    expect(
      formatServerHttpDiagnostic({
        status: 409,
        serverMessage: 'Ocupado',
        targetUrl: 'https://worker.test/api/rooms',
      })
    ).toContain('HTTP 409');

    expect(
      formatServerHttpDiagnostic({
        status: 500,
        errorCode: 'DATABASE_ERROR',
        serverMessage: 'D1 query failed',
        targetUrl: 'https://worker.test/api/rooms',
      })
    ).toContain('base de datos D1');

    // Simular timeout en createRoom del store sin ocultar causa
    const abortErr = new DOMException('Timed out', 'AbortError');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortErr);
    useGameStore.setState({ screen: 'create_join', roomState: null, errorMessage: null });
    await useGameStore.getState().createRoom({
      teacherName: 'Docente Test',
      teacherPin: 'PIN2026',
      config: { mode: 'teams', teamCount: 3, maxPlayers: 15 },
    });
    expect(useGameStore.getState().screen).toBe('create_join');
    expect(useGameStore.getState().errorMessage).toContain('Tiempo de espera agotado');
    fetchSpy.mockRestore();
  });

  it('ejecuta flujo completo en producción: crear sala -> código -> unir alumno -> rechazar XYZ999 -> iniciar -> sincronizar -> cerrar sala', async () => {
    const { env, namespaces } = createProdWorkerEnv();
    const pagesOrigin = 'https://prl-oca-3d.pages.dev';

    // 1. Crear sala como profesor desde origen Pages real
    const createRes = await workerEntry.fetch(
      new Request('https://prl-oca-realtime.cuenta.workers.dev/api/rooms', {
        method: 'POST',
        headers: {
          Origin: pagesOrigin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teacherName: 'Prof. Prevención',
          teacherPin: 'DOC2026',
          config: { mode: 'teams', teamCount: 3, maxPlayers: 15, wrongAnswerPenalty: 1 },
        }),
      }),
      env as never
    );
    expect(createRes.status).toBe(200);
    expect(createRes.headers.get('Access-Control-Allow-Origin')).toBe(pagesOrigin);
    const created = (await createRes.json()) as {
      success: boolean;
      roomCode: string;
      teacherToken: string;
      state: GameRoomState;
    };
    expect(created.success).toBe(true);
    expect(created.roomCode).toMatch(/^PRL[A-Z0-9]{3}$/);

    // 2 y 3. Conectar profesor + alumno válido usando el código real
    const rec = namespaces.get(created.roomCode)!;
    const tSock = new MockSocket();
    const sSock = new MockSocket();
    rec.sockets.push(tSock, sSock);

    await rec.instance.webSocketMessage(
      tSock as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 't_join',
        playerId: 'prof_1',
        playerName: 'Prof. Prevención',
        isTeacher: true,
        teacherPin: 'DOC2026',
      })
    );

    const joinRes = await workerEntry.fetch(
      new Request(
        `https://prl-oca-realtime.cuenta.workers.dev/api/rooms/${created.roomCode}/join`,
        {
          method: 'POST',
          headers: { Origin: pagesOrigin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: 'alu_1', playerName: 'María' }),
        }
      ),
      env as never
    );
    expect(joinRes.status).toBe(200);
    const joinJson = (await joinRes.json()) as { playerToken: string };

    await rec.instance.webSocketMessage(
      sSock as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 's_join',
        playerId: 'alu_1',
        playerName: 'María',
        playerToken: joinJson.playerToken,
      })
    );

    // 4. Rechazar código inventado XYZ999
    const fakeRes = await workerEntry.fetch(
      new Request('https://prl-oca-realtime.cuenta.workers.dev/api/rooms/XYZ999/join', {
        method: 'POST',
        headers: { Origin: pagesOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'alu_bad', playerName: 'Perdido' }),
      }),
      env as never
    );
    expect(fakeRes.status).toBe(404);
    expect(((await fakeRes.json()) as { error: string }).error).toBe('ROOM_NOT_FOUND');

    // 5 y 6. Iniciar partida y comprobar sincronización profesor + alumno
    const startRes = await workerEntry.fetch(
      new Request(
        `https://prl-oca-realtime.cuenta.workers.dev/api/rooms/${created.roomCode}/teacher-action`,
        {
          method: 'POST',
          headers: {
            Origin: pagesOrigin,
            'Content-Type': 'application/json',
            'X-Teacher-Token': created.teacherToken,
          },
          body: JSON.stringify({
            teacherToken: created.teacherToken,
            command: { kind: 'START_GAME' },
          }),
        }
      ),
      env as never
    );
    expect(startRes.status).toBe(200);
    expect(tSock.messagesOfType('GAME_STARTED')).toHaveLength(1);
    expect(sSock.messagesOfType('GAME_STARTED')).toHaveLength(1);
    expect(sSock.messagesOfType('STATE_SYNC').slice(-1)[0]?.state.status).toBe('playing');

    // 7. Cerrar sala y verificar rechazo posterior
    const closeRes = await workerEntry.fetch(
      new Request(
        `https://prl-oca-realtime.cuenta.workers.dev/api/rooms/${created.roomCode}/teacher-action`,
        {
          method: 'POST',
          headers: {
            Origin: pagesOrigin,
            'Content-Type': 'application/json',
            'X-Teacher-Token': created.teacherToken,
          },
          body: JSON.stringify({
            teacherToken: created.teacherToken,
            command: { kind: 'CLOSE_ROOM' },
          }),
        }
      ),
      env as never
    );
    expect(closeRes.status).toBe(200);

    const afterClose = await workerEntry.fetch(
      new Request(
        `https://prl-oca-realtime.cuenta.workers.dev/api/rooms/${created.roomCode}/join`,
        {
          method: 'POST',
          headers: { Origin: pagesOrigin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: 'Tardío' }),
        }
      ),
      env as never
    );
    expect(afterClose.status).toBe(410);
    expect(((await afterClose.json()) as { error: string }).error).toBe('ROOM_CLOSED');
  });
});
