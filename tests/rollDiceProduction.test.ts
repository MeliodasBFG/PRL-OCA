import { describe, expect, it, vi } from 'vitest';
import {
  GameRoomState,
  INITIAL_QUESTION_BANK,
  ServerToClientMessage,
  advanceTurnServerSide,
  canPlayerActOnTeamTurn,
  createInitialRoomState,
  joinPlayerToState,
} from '@prl-oca/shared';
import workerEntry, { GameRoom } from '../apps/realtime/src/index';
import {
  diagnoseFetchConnectionFailure,
  formatServerHttpDiagnostic,
  resolveWebSocketCandidateUrls,
} from '../apps/web/src/utils/networkConfig';
import { useGameStore } from '../apps/web/src/stores/useGameStore';

const PROD_ORIGIN = 'https://prl-oca.pages.dev';
const WORKER_URL = 'https://realtime.danielcalvinoouro.workers.dev';
const PROD_ALLOWED_ORIGIN =
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

interface SimulatedDORecord {
  roomCode: string;
  storageMap: Map<string, unknown>;
  sockets: MockSocket[];
  ctx: {
    storage: {
      get: <T>(key: string) => Promise<T | undefined>;
      put: (key: string, val: unknown) => Promise<void>;
    };
    getWebSockets: () => WebSocket[];
  };
  instance: GameRoom;
}

function createProdWorkerHarness(options?: { secret?: string; simulateDbCrash?: boolean }) {
  const namespaces = new Map<string, SimulatedDORecord>();

  const buildInstance = (ctx: SimulatedDORecord['ctx']) =>
    new GameRoom(ctx as never, {
      GAME_ROOMS: {} as DurableObjectNamespace,
      ENVIRONMENT: 'production',
      ALLOWED_ORIGIN: PROD_ALLOWED_ORIGIN,
      TEACHER_TOKEN_SECRET: options?.secret ?? 'prod-roll-secret',
      DB: options?.simulateDbCrash
        ? ({
            prepare: () => {
              throw new Error('Simulated D1 failure');
            },
          } as unknown as D1Database)
        : ({
            prepare: () => ({
              bind: () => ({
                all: async () => ({ results: [] }),
                run: async () => ({ success: true }),
              }),
              all: async () => ({ results: INITIAL_QUESTION_BANK }),
            }),
          } as unknown as D1Database),
    });

  const getOrCreateRecord = (name: string): SimulatedDORecord => {
    const existing = namespaces.get(name);
    if (existing) return existing;
    const storageMap = new Map<string, unknown>();
    const sockets: MockSocket[] = [];
    const ctx: SimulatedDORecord['ctx'] = {
      storage: {
        get: async <T>(key: string) => storageMap.get(key) as T | undefined,
        put: async (key: string, val: unknown) => {
          storageMap.set(key, val);
        },
      },
      getWebSockets: () => sockets as unknown as WebSocket[],
    };
    const rec: SimulatedDORecord = {
      roomCode: name,
      storageMap,
      sockets,
      ctx,
      instance: buildInstance(ctx),
    };
    namespaces.set(name, rec);
    return rec;
  };

  const env = {
    ENVIRONMENT: 'production',
    ALLOWED_ORIGIN: PROD_ALLOWED_ORIGIN,
    TEACHER_TOKEN_SECRET: options?.secret ?? 'prod-roll-secret',
    GAME_ROOMS: {
      idFromName: (name: string) => name as unknown as DurableObjectId,
      get: (id: DurableObjectId) => ({
        fetch: (req: Request) => getOrCreateRecord(String(id)).instance.fetch(req),
      }),
    },
    DB: {
      prepare: () => ({
        bind: () => ({ all: async () => ({ results: [] }), run: async () => ({ success: true }) }),
        all: async () => ({ results: INITIAL_QUESTION_BANK }),
      }),
    },
  };

  return {
    httpFetch: (path: string, init?: RequestInit, origin: string | null = PROD_ORIGIN) => {
      const headers = new Headers(init?.headers);
      if (origin !== null && !headers.has('Origin')) {
        headers.set('Origin', origin);
      }
      return workerEntry.fetch(new Request(`${WORKER_URL}${path}`, { ...init, headers }), env as never);
    },
    hibernateAndWake: (roomCode: string) => {
      const rec = getOrCreateRecord(roomCode.toUpperCase());
      rec.instance = buildInstance(rec.ctx);
      return rec;
    },
    connectSocket: async (roomCode: string, joinMsg: Record<string, unknown>) => {
      const rec = getOrCreateRecord(roomCode.toUpperCase());
      const sock = new MockSocket();
      rec.sockets.push(sock);
      await rec.instance.webSocketMessage(sock as unknown as WebSocket, JSON.stringify(joinMsg));
      return sock;
    },
    closeSocket: async (roomCode: string, sock: MockSocket) => {
      const rec = getOrCreateRecord(roomCode.toUpperCase());
      const idx = rec.sockets.indexOf(sock);
      if (idx >= 0) rec.sockets.splice(idx, 1);
      await rec.instance.webSocketClose(sock as unknown as WebSocket);
    },
    sendWs: async (roomCode: string, sock: MockSocket, msg: Record<string, unknown>) => {
      const rec = getOrCreateRecord(roomCode.toUpperCase());
      await rec.instance.webSocketMessage(sock as unknown as WebSocket, JSON.stringify(msg));
    },
    getRecord: (roomCode: string) => namespaces.get(roomCode.toUpperCase()),
  };
}

async function setupPlayingMatch(
  harness: ReturnType<typeof createProdWorkerHarness>,
  studentCount = 1,
  teamCount = 2,
  options?: { teacherParticipatesAsPlayer?: boolean }
) {
  const teacherParticipatesAsPlayer = Boolean(options?.teacherParticipatesAsPlayer);
  const createRes = await harness.httpFetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherPin: 'PIN2026',
      teacherName: 'Prof. Producción',
      teacherParticipatesAsPlayer,
      config: {
        roomName: 'Simulación Producción',
        mode: 'teams',
        teamCount,
        maxPlayers: 15,
        diceMode: '1d6',
      },
    }),
  });
  const room = (await createRes.json()) as {
    ok: boolean;
    roomCode: string;
    playerId: string;
    playerToken: string;
    teacherToken: string;
    state: GameRoomState;
  };

  const teacherSock = await harness.connectSocket(room.roomCode, {
    type: 'JOIN_ROOM',
    actionId: 'join_t',
    playerId: room.playerId,
    playerName: 'Prof. Producción',
    isTeacher: true,
    participatesAsPlayer: teacherParticipatesAsPlayer,
    teacherToken: room.teacherToken,
    playerToken: room.playerToken,
  });

  const students: Array<{
    playerId: string;
    playerToken: string;
    playerName: string;
    sock: MockSocket;
    state: GameRoomState;
  }> = [];

  for (let i = 1; i <= studentCount; i++) {
    const jRes = await harness.httpFetch(`/api/rooms/${room.roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: `Alumno ${i}` }),
    });
    const jData = (await jRes.json()) as {
      ok: boolean;
      playerId: string;
      playerToken: string;
      state: GameRoomState;
    };
    const sock = await harness.connectSocket(room.roomCode, {
      type: 'JOIN_ROOM',
      actionId: `join_s_${i}`,
      playerId: jData.playerId,
      playerName: `Alumno ${i}`,
      playerToken: jData.playerToken,
    });
    students.push({
      playerId: jData.playerId,
      playerToken: jData.playerToken,
      playerName: `Alumno ${i}`,
      sock,
      state: jData.state,
    });
  }

  await harness.sendWs(room.roomCode, teacherSock, {
    type: 'TEACHER_ACTION',
    actionId: 'start_match',
    teacherToken: room.teacherToken,
    command: { kind: 'START_GAME' },
  });

  return { room, teacherSock, students };
}

describe('ROLL_DICE en Producción: CORS /action, WebSocket, Fallback HTTP, Idempotencia y Diagnóstico (Pruebas 1-12)', () => {
  it('PRUEBA 1 y 2: Profesor y Alumno conectados por WebSocket lanzan dados autoritativamente en servidor', async () => {
    const harness = createProdWorkerHarness();
    const { room, teacherSock, students } = await setupPlayingMatch(harness, 1, 2);

    // Alumno en turno lanza dado por WebSocket
    await harness.sendWs(room.roomCode, students[0].sock, {
      type: 'ROLL_DICE',
      actionId: 'ws_roll_student',
      playerId: students[0].playerId,
      playerToken: students[0].playerToken,
    });

    expect(students[0].sock.messagesOfType('ERROR')).toHaveLength(0);
    const rolledS = students[0].sock.messagesOfType('DICE_ROLLED');
    expect(rolledS).toHaveLength(1);
    expect(rolledS[0].roll.rolledByPlayerId).toBe(students[0].playerId);
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);

    // Nueva partida con docente participante: cuando ES su turno lanza por WebSocket y mueve su ficha
    const harness2 = createProdWorkerHarness();
    const m2 = await setupPlayingMatch(harness2, 1, 2, { teacherParticipatesAsPlayer: true });
    await harness2.sendWs(m2.room.roomCode, m2.teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'ws_roll_teacher',
      playerId: m2.room.playerId,
      playerToken: m2.room.playerToken,
    });
    expect(m2.teacherSock.messagesOfType('ERROR')).toHaveLength(0);
    expect(m2.teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    expect(m2.students[0].sock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
  });

  it('PRUEBA 3 y 4: Preflight OPTIONS de /action permite X-Player-Token desde https://prl-oca.pages.dev (sin "*") y POST /action responde HTTP 200', async () => {
    const harness = createProdWorkerHarness();
    const { room, students } = await setupPlayingMatch(harness, 1, 2);

    // Preflight exacto que envía Chrome/Edge cuando useGameStore manda X-Player-Token + X-Player-Id
    const preflight = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'OPTIONS',
      headers: {
        Origin: PROD_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-player-token,x-player-id',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
    const allowHeaders = (preflight.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase();
    expect(allowHeaders).toContain('content-type');
    expect(allowHeaders).toContain('x-player-token');
    expect(allowHeaders).toContain('x-player-id');
    expect(allowHeaders).toContain('authorization');

    // Preflight no exige autenticación y POST real con playerToken válido retorna HTTP 200
    const actionRes = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': students[0].playerToken,
        'X-Player-Id': students[0].playerId,
      },
      body: JSON.stringify({
        playerId: students[0].playerId,
        playerToken: students[0].playerToken,
        message: {
          type: 'ROLL_DICE',
          actionId: 'http_roll_ok_1',
          playerId: students[0].playerId,
          playerToken: students[0].playerToken,
        },
      }),
    });
    expect(actionRes.status).toBe(200);
    expect(actionRes.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
    const data = (await actionRes.json()) as {
      ok: boolean;
      event: ServerToClientMessage;
      state: GameRoomState;
    };
    expect(data.ok).toBe(true);
    expect(data.event.type).toBe('DICE_ROLLED');
  });

  it('PRUEBA 5, 6 y 7: Rechaza token incorrecto (401 INVALID_PLAYER_TOKEN), jugador ajeno (404 PLAYER_NOT_FOUND) y fuera de turno (409 NOT_YOUR_TURN) con cabeceras CORS', async () => {
    const harness = createProdWorkerHarness();
    const { room, students } = await setupPlayingMatch(harness, 2, 2);

    // Token incorrecto -> HTTP 401 INVALID_PLAYER_TOKEN + CORS intacto
    const badTokenRes = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': 'INVALID.TOKEN',
      },
      body: JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'http_bad_token',
        playerId: students[0].playerId,
        playerToken: 'INVALID.TOKEN',
      }),
    });
    expect(badTokenRes.status).toBe(401);
    expect(badTokenRes.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
    const badTokenJson = (await badTokenRes.json()) as { error: string };
    expect(badTokenJson.error).toBe('INVALID_PLAYER_TOKEN');

    // Jugador que no pertenece a la sala -> HTTP 404 PLAYER_NOT_FOUND + CORS intacto
    const outsiderRes = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': students[0].playerToken,
      },
      body: JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'http_outsider',
        playerId: 'plr_outsider_999',
        playerToken: students[0].playerToken,
      }),
    });
    // Token no corresponde al playerId o jugador no existe -> nunca pasa
    expect([401, 404]).toContain(outsiderRes.status);
    expect(outsiderRes.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);

    // Jugador perteneciente a equipo distinto al activo -> HTTP 409 NOT_YOUR_TURN + WS ERROR NOT_YOUR_TURN
    const outOfTurnStu = students[1];
    const ootHttp = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': outOfTurnStu.playerToken,
      },
      body: JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'http_not_your_turn',
        playerId: outOfTurnStu.playerId,
        playerToken: outOfTurnStu.playerToken,
      }),
    });
    expect(ootHttp.status).toBe(409);
    expect(ootHttp.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
    const ootJson = (await ootHttp.json()) as { error: string; message: string };
    expect(ootJson.error).toBe('NOT_YOUR_TURN');
    expect(ootJson.message).toContain('Es el turno de');

    // Error 400 JSON inválido también conserva CORS
    const badReq = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': students[0].playerToken },
      body: JSON.stringify({ type: 'UNKNOWN_OP' }),
    });
    expect(badReq.status).toBe(400);
    expect(badReq.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
  });

  it('PRUEBA 8 y 9: WebSocket desconectado usa fallback HTTP en useGameStore y alterna entre VITE_WS_URL erróneo y VITE_API_URL en reconexión', async () => {
    vi.useFakeTimers();
    const harness = createProdWorkerHarness();
    const { room, students, teacherSock } = await setupPlayingMatch(harness, 1, 2);

    // Comprobar resolución de URLs WebSocket cuando VITE_WS_URL tiene doble subdominio
    const candidates = resolveWebSocketCandidateUrls(
      room.roomCode,
      {
        VITE_WS_URL: 'wss://prl-oca-realtime.realtime.danielcalvinoouro.workers.dev',
        VITE_API_URL: 'wss://realtime.danielcalvinoouro.workers.dev',
      },
      { protocol: 'https:', hostname: 'prl-oca.pages.dev' }
    );
    expect(candidates).toEqual([
      `wss://prl-oca-realtime.realtime.danielcalvinoouro.workers.dev/ws/${room.roomCode}`,
      `wss://realtime.danielcalvinoouro.workers.dev/ws/${room.roomCode}`,
    ]);

    // Simular store en sesión remota con WS desconectado llamando al Worker vía fetch interceptado
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const parsed = new URL(url);
      return harness.httpFetch(parsed.pathname, init);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:8787' },
      sessionStorage: {
        getItem: () => null,
        setItem: () => {},
      },
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
    });

    try {
      const latestState = teacherSock.messagesOfType('GAME_STARTED')[0]!.state;
      useGameStore.setState({
        screen: 'game',
        isRemoteSession: true,
        connectionStatus: 'disconnected',
        playerId: students[0].playerId,
        playerToken: students[0].playerToken,
        roomState: latestState,
        isRollingAnimation: false,
        isTokenMoving: false,
        errorMessage: null,
      });

      useGameStore.getState().rollDice();
      await vi.advanceTimersByTimeAsync(1200);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0]!;
      expect(String(calledUrl)).toContain(`/api/rooms/${room.roomCode}/action`);
      const hdrs = calledInit?.headers as Record<string, string>;
      expect(hdrs['X-Player-Token']).toBe(students[0].playerToken);
      expect(hdrs['X-Player-Id']).toBe(students[0].playerId);

      // El resultado llega sincronizado al tablero local y al WebSocket del profesor
      expect(useGameStore.getState().errorMessage).toBeNull();
      expect(useGameStore.getState().roomState?.lastDiceRoll?.rolledByPlayerId).toBe(
        students[0].playerId
      );
      expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('PRUEBA 10: Sin duplicación de lanzamientos (idempotencia por actionId incluso tras timeout o hibernación del DO)', async () => {
    const harness = createProdWorkerHarness();
    const { room, students, teacherSock } = await setupPlayingMatch(harness, 1, 2);

    const payload = {
      playerId: students[0].playerId,
      playerToken: students[0].playerToken,
      message: {
        type: 'ROLL_DICE',
        actionId: 'roll_idempotent_777',
        playerId: students[0].playerId,
        playerToken: students[0].playerToken,
      },
    };

    const firstRes = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': students[0].playerToken,
      },
      body: JSON.stringify(payload),
    });
    expect(firstRes.status).toBe(200);
    const firstData = (await firstRes.json()) as {
      ok: boolean;
      deduplicated?: boolean;
      event: Extract<ServerToClientMessage, { type: 'DICE_ROLLED' }>;
    };
    expect(firstData.deduplicated).toBe(false);
    const originalTotal = firstData.event.roll.total;
    const originalTile = firstData.state.teams[0].position;

    // Simular hibernación del Durable Object + reintento tras pérdida de respuesta / timeout con MISMO actionId
    harness.hibernateAndWake(room.roomCode);

    const retryRes = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': students[0].playerToken,
      },
      body: JSON.stringify(payload),
    });
    expect(retryRes.status).toBe(200);
    const retryData = (await retryRes.json()) as {
      ok: boolean;
      deduplicated?: boolean;
      event: Extract<ServerToClientMessage, { type: 'DICE_ROLLED' }>;
      state: GameRoomState;
    };
    expect(retryData.deduplicated).toBe(true);
    expect(retryData.event.roll.total).toBe(originalTotal);
    expect(retryData.state.teams[0].position).toBe(originalTile);
    // Solo se difundió UNA tirada a los sockets conectados
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
  });

  it('PRUEBA 11 y 12: Partida con 15 participantes recibe difusión de ROLL_DICE por HTTP fallback y distingue diagnósticos de error', async () => {
    const harness = createProdWorkerHarness();
    const { room, teacherSock, students } = await setupPlayingMatch(harness, 15, 3);

    expect(students).toHaveLength(15);
    const activeTeamId = teacherSock.messagesOfType('GAME_STARTED')[0]!.state.teams[0].id;
    const activeStudent = students.find((s) =>
      s.state.players.find((p) => p.id === s.playerId && p.teamId === activeTeamId)
    )!;

    // Uno de los 15 lanza dado vía HTTP fallback -> TODOS los 15 + profesor reciben DICE_ROLLED idéntico
    const res = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': activeStudent.playerToken,
        'X-Player-Id': activeStudent.playerId,
      },
      body: JSON.stringify({
        playerId: activeStudent.playerId,
        playerToken: activeStudent.playerToken,
        message: {
          type: 'ROLL_DICE',
          actionId: 'roll_15p_http',
          playerId: activeStudent.playerId,
          playerToken: activeStudent.playerToken,
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      event: Extract<ServerToClientMessage, { type: 'DICE_ROLLED' }>;
    };
    const authoritativeTotal = body.event.roll.total;

    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    for (const s of students) {
      const msgs = s.sock.messagesOfType('DICE_ROLLED');
      expect(msgs).toHaveLength(1);
      expect(msgs[0].roll.total).toBe(authoritativeTotal);
    }

    // Diagnósticos explícitos de FASE 7
    expect(
      formatServerHttpDiagnostic({ status: 400, errorCode: 'VALIDATION_ERROR', targetUrl: `${WORKER_URL}/api/rooms/${room.roomCode}/action` })
    ).toContain('HTTP 400');
    expect(
      formatServerHttpDiagnostic({ status: 401, errorCode: 'INVALID_PLAYER_TOKEN', serverMessage: 'Token inválido', targetUrl: `${WORKER_URL}/api/rooms/${room.roomCode}/action` })
    ).toContain('INVALID_PLAYER_TOKEN');
    expect(
      formatServerHttpDiagnostic({ status: 403, errorCode: 'UNAUTHORIZED_PLAYER', serverMessage: 'No autorizado', targetUrl: `${WORKER_URL}/api/rooms/${room.roomCode}/action` })
    ).toContain('UNAUTHORIZED_PLAYER');
    expect(
      formatServerHttpDiagnostic({ status: 404, errorCode: 'PLAYER_NOT_FOUND', serverMessage: 'No encontrado', targetUrl: `${WORKER_URL}/api/rooms/${room.roomCode}/action` })
    ).toContain('PLAYER_NOT_FOUND');
    expect(
      formatServerHttpDiagnostic({ status: 409, errorCode: 'NOT_YOUR_TURN', serverMessage: 'Es el turno del Equipo Naranja', targetUrl: `${WORKER_URL}/api/rooms/${room.roomCode}/action` })
    ).toContain('NOT_YOUR_TURN');
    expect(
      formatServerHttpDiagnostic({ status: 500, errorCode: 'DURABLE_OBJECT_ERROR', serverMessage: 'Storage error', targetUrl: `${WORKER_URL}/api/rooms/${room.roomCode}/action` })
    ).toContain('Durable Objects');

    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';
    const timeoutMsg = await diagnoseFetchConnectionFailure({
      error: abortErr,
      apiBase: WORKER_URL,
      targetUrl: `${WORKER_URL}/api/rooms/${room.roomCode}/action`,
      actionLabel: 'enviar el lanzamiento de dados',
    });
    expect(timeoutMsg).toContain('Timeout');
  });

  it('PRUEBA 13: Bloqueo estricto de turno en cliente y servidor — un alumno fuera de turno no puede lanzar el dado ni mover la ficha de otro alumno', async () => {
    vi.useFakeTimers();
    const harness = createProdWorkerHarness();
    const { room, teacherSock, students } = await setupPlayingMatch(harness, 2, 2);

    const startedState = teacherSock.messagesOfType('GAME_STARTED')[0]!.state;
    const activeTeamId = startedState.teams[startedState.activeTeamIndex].id;
    const outOfTurnStu = students.find(
      (s) => startedState.players.find((p) => p.id === s.playerId)?.teamId !== activeTeamId
    )!;
    const activeStu = students.find((s) => s.playerId !== outOfTurnStu.playerId)!;

    // 1. Validar helper compartido canPlayerActOnTeamTurn
    expect(canPlayerActOnTeamTurn(startedState, activeStu.playerId).allowed).toBe(true);
    const outCheck = canPlayerActOnTeamTurn(startedState, outOfTurnStu.playerId);
    expect(outCheck.allowed).toBe(false);
    expect(outCheck.errorCode).toBe('NOT_YOUR_TURN');

    // 2. Simular en useGameStore que el alumno fuera de turno intenta rollDice (ni anima ni llama al servidor)
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      useGameStore.setState({
        screen: 'game',
        isRemoteSession: true,
        connectionStatus: 'disconnected',
        playerId: outOfTurnStu.playerId,
        playerToken: outOfTurnStu.playerToken,
        isTeacher: false,
        isSpectator: false,
        roomState: structuredClone(startedState),
        isRollingAnimation: false,
        isTokenMoving: false,
        errorMessage: null,
      });

      useGameStore.getState().rollDice();
      await vi.advanceTimersByTimeAsync(1300);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(useGameStore.getState().isRollingAnimation).toBe(false);
      expect(useGameStore.getState().errorMessage).toContain('Es el turno de');
      // La posición de ambos equipos sigue exactamente en 1
      expect(useGameStore.getState().roomState?.teams[0].position).toBe(1);
      expect(useGameStore.getState().roomState?.teams[1].position).toBe(1);

      // 3. También en modo local (sin sesión remota) nunca sustituye playerId por el del otro alumno
      useGameStore.setState({
        isRemoteSession: false,
        roomState: structuredClone(startedState),
        isRollingAnimation: false,
        isTokenMoving: false,
        errorMessage: null,
      });
      useGameStore.getState().rollDice();
      await vi.advanceTimersByTimeAsync(1300);
      expect(useGameStore.getState().roomState?.teams[0].position).toBe(1);
      expect(useGameStore.getState().roomState?.teams[1].position).toBe(1);
      expect(useGameStore.getState().errorMessage).toContain('Es el turno de');
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }

    // 4. Alumno fuera de turno también es rechazado por servidor (HTTP 409 NOT_YOUR_TURN) y no mueve ninguna ficha
    const outHttp = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': outOfTurnStu.playerToken,
        'X-Player-Id': outOfTurnStu.playerId,
      },
      body: JSON.stringify({
        playerId: outOfTurnStu.playerId,
        playerToken: outOfTurnStu.playerToken,
        message: {
          type: 'ROLL_DICE',
          actionId: 'out_stu_roll_blocked',
          playerId: outOfTurnStu.playerId,
          playerToken: outOfTurnStu.playerToken,
        },
      }),
    });
    expect(outHttp.status).toBe(409);
    expect(((await outHttp.json()) as { error: string }).error).toBe('NOT_YOUR_TURN');
    const statePoll = (await (await harness.httpFetch(`/api/rooms/${room.roomCode}`)).json()) as {
      state: GameRoomState;
    };
    expect(statePoll.state.teams[0].position).toBe(1);
    expect(statePoll.state.teams[1].position).toBe(1);

    // 5. Modo individual con 2 alumnos: advanceTurnServerSide salta slots vacíos (team_3..team_15)
    const indState = createInitialRoomState('INDV01', {
      mode: 'individual',
      maxPlayers: 15,
    });
    joinPlayerToState(indState, { playerId: 'ind_1', playerName: 'Luis', preferredTeamId: 'team_1' });
    joinPlayerToState(indState, { playerId: 'ind_2', playerName: 'Marta', preferredTeamId: 'team_2' });
    indState.status = 'playing';
    expect(indState.activeTeamIndex).toBe(0);
    advanceTurnServerSide(indState);
    expect(indState.activeTeamIndex).toBe(1);
    advanceTurnServerSide(indState);
    expect(indState.activeTeamIndex).toBe(0);
    expect(indState.turnNumber).toBe(2);
  });
});
