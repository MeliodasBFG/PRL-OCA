import { describe, expect, it, vi } from 'vitest';
import {
  GameRoomState,
  INITIAL_QUESTION_BANK,
  ServerToClientMessage,
  isValidRoomCodeFormat,
  normalizeRoomCode,
} from '@prl-oca/shared';
import workerEntry, { GameRoom } from '../apps/realtime/src/index';
import { isLocalFallbackEnabled } from '../apps/web/src/utils/networkConfig';
import { useGameStore } from '../apps/web/src/stores/useGameStore';

class MockSocket {
  public inbox: ServerToClientMessage[] = [];
  public closedWith: { code?: number; reason?: string } | null = null;
  private attachment: unknown = undefined;

  public send(payload: string): void {
    this.inbox.push(JSON.parse(payload) as ServerToClientMessage);
  }

  public close(code?: number, reason?: string): void {
    this.closedWith = { code, reason };
  }

  public serializeAttachment(att: unknown): void {
    this.attachment = att;
  }

  public deserializeAttachment(): unknown {
    return this.attachment;
  }

  public lastMessage(): ServerToClientMessage | undefined {
    return this.inbox[this.inbox.length - 1];
  }
}

interface SimulatedDORecord {
  roomCode: string;
  storageMap: Map<string, unknown>;
  sockets: MockSocket[];
  instance: GameRoom;
}

function createWorkerHarness(options?: { secret?: string }) {
  const namespaces = new Map<string, SimulatedDORecord>();
  const routedIds: string[] = [];

  const getOrCreateRecord = (name: string): SimulatedDORecord => {
    const existing = namespaces.get(name);
    if (existing) return existing;

    const storageMap = new Map<string, unknown>();
    const sockets: MockSocket[] = [];
    const ctx = {
      storage: {
        get: async <T>(key: string) => storageMap.get(key) as T | undefined,
        put: async (key: string, val: unknown) => {
          storageMap.set(key, val);
        },
      },
      getWebSockets: () => sockets as unknown as WebSocket[],
    };
    const instance = new GameRoom(ctx as never, {
      GAME_ROOMS: {} as DurableObjectNamespace,
      TEACHER_TOKEN_SECRET: options?.secret,
    });
    const rec: SimulatedDORecord = { roomCode: name, storageMap, sockets, instance };
    namespaces.set(name, rec);
    return rec;
  };

  const env = {
    ENVIRONMENT: 'production',
    ALLOWED_ORIGIN: '*',
    TEACHER_TOKEN_SECRET: options?.secret,
    GAME_ROOMS: {
      idFromName: (name: string) => {
        routedIds.push(name);
        return name as unknown as DurableObjectId;
      },
      get: (id: DurableObjectId) => {
        const key = String(id);
        return {
          fetch: (req: Request) => getOrCreateRecord(key).instance.fetch(req),
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

  /** Seeds a specific room code directly through Teacher POST /init + registration cleanly */
  const createRoomWithCode = async (
    roomCode: string,
    teacherPin = 'DOC2026',
    config?: Record<string, unknown>
  ) => {
    const normalized = normalizeRoomCode(roomCode);
    const rec = getOrCreateRecord(normalized);
    const initRes = await rec.instance.fetch(
      new Request(`https://internal/init?roomCode=${normalized}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: normalized,
          teacherPin,
          config: {
            mode: 'teams',
            teamCount: 3,
            maxPlayers: 15,
            allowLateJoin: false,
            ...(config ?? {}),
          },
        }),
      })
    );
    const initData = (await initRes.json()) as {
      success: boolean;
      ok: boolean;
      roomCode: string;
      teacherToken: string;
      state: GameRoomState;
    };
    return { rec, initData };
  };

  return {
    env,
    namespaces,
    routedIds,
    getRecord: (code: string) => namespaces.get(normalizeRoomCode(code)),
    createRoomWithCode,
    callWorker: (path: string, init?: RequestInit) =>
      workerEntry.fetch(new Request(`https://worker.test${path}`, init), env as never),
  };
}

describe('Validación obligatoria de existencia de salas y seguridad (Pruebas 1-12 + Integración)', () => {
  it('PRUEBA 1: El profesor crea ABC123 y el alumno introduce ABC123 -> conexión permitida', async () => {
    const harness = createWorkerHarness({ secret: 'top_secret' });
    const { rec } = await harness.createRoomWithCode('ABC123', 'PIN1234');

    const joinRes = await harness.callWorker('/api/rooms/ABC123/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'ABC123',
        playerId: 'stu_1',
        playerName: 'Lucía',
      }),
    });
    expect(joinRes.status).toBe(200);
    const json = (await joinRes.json()) as {
      success: boolean;
      ok: boolean;
      roomCode: string;
      playerId: string;
      playerToken: string;
      state: GameRoomState;
    };
    expect(json.success).toBe(true);
    expect(json.roomCode).toBe('ABC123');
    expect(json.playerToken).toBeTruthy();

    // También debe poder conectar su WebSocket y completar JOIN_ROOM
    const ws = new MockSocket();
    rec.sockets.push(ws);
    await rec.instance.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'join_1',
        playerId: json.playerId,
        playerName: 'Lucía',
        playerToken: json.playerToken,
      })
    );
    const sync = ws.lastMessage();
    expect(sync?.type).toBe('STATE_SYNC');
    if (sync?.type === 'STATE_SYNC') {
      expect(sync.state.roomCode).toBe('ABC123');
      expect(sync.state.players.some((p) => p.name === 'Lucía')).toBe(true);
    }
  });

  it('PRUEBA 2: Profesor crea ABC123 pero alumno introduce XYZ999 -> ROOM_NOT_FOUND (HTTP 404 y frontend rechazado)', async () => {
    const harness = createWorkerHarness({ secret: 'top_secret' });
    await harness.createRoomWithCode('ABC123', 'PIN1234');

    const joinWrong = await harness.callWorker('/api/rooms/XYZ999/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'stu_x', playerName: 'Intruder' }),
    });
    expect(joinWrong.status).toBe(404);
    const wrongJson = (await joinWrong.json()) as {
      success: boolean;
      error: string;
      message: string;
    };
    expect(wrongJson.success).toBe(false);
    expect(wrongJson.error).toBe('ROOM_NOT_FOUND');

    const getWrong = await harness.callWorker('/api/rooms/XYZ999');
    expect(getWrong.status).toBe(404);
    expect(((await getWrong.json()) as { error: string }).error).toBe('ROOM_NOT_FOUND');

    // Frontend joinRoom nunca debe abrir Lobby para XYZ999
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url = String(input);
        const path = new URL(url).pathname;
        return harness.callWorker(path, { method: 'POST', body: '{}' });
      });

    useGameStore.setState({ screen: 'create_join', roomState: null, errorMessage: null });
    await useGameStore.getState().joinRoom({
      roomCode: 'XYZ999',
      playerName: 'Alumno Perdido',
    });
    expect(useGameStore.getState().screen).toBe('create_join');
    expect(useGameStore.getState().roomState).toBeNull();
    expect(useGameStore.getState().errorMessage).toContain('No existe ninguna partida');
    fetchSpy.mockRestore();
  });

  it('PRUEBA 3: No existe ninguna sala y alumno introduce cualquier código -> ROOM_NOT_FOUND', async () => {
    const harness = createWorkerHarness();

    for (const code of ['PRL001', 'AAA999', 'SALA07']) {
      const resJoin = await harness.callWorker(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: 'Alumno' }),
      });
      expect(resJoin.status).toBe(404);
      const body = (await resJoin.json()) as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('ROOM_NOT_FOUND');

      const resState = await harness.callWorker(`/api/rooms/${code}`);
      expect(resState.status).toBe(404);
    }

    // Formato inválido -> INVALID_ROOM_CODE (400) sin crear ningún DO
    expect(isValidRoomCodeFormat('AB')).toBe(false);
    expect(isValidRoomCodeFormat('XYZ$99')).toBe(false);
    const badFormat = await harness.callWorker('/api/rooms/AB/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Alumno' }),
    });
    expect(badFormat.status).toBe(400);
    expect(((await badFormat.json()) as { error: string }).error).toBe('INVALID_ROOM_CODE');
  });

  it('PRUEBA 4: Código con espacios " ABC123 " se normaliza a ABC123 y permite entrar', async () => {
    const harness = createWorkerHarness();
    await harness.createRoomWithCode('ABC123');

    const joinSpaced = await harness.callWorker('/api/rooms/%20ABC123%20/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: '  ABC123  ', playerName: 'Ana' }),
    });
    expect(joinSpaced.status).toBe(200);
    const data = (await joinSpaced.json()) as { success: boolean; roomCode: string };
    expect(data.success).toBe(true);
    expect(data.roomCode).toBe('ABC123');
  });

  it('PRUEBA 5: Código en minúsculas "abc123" se normaliza a ABC123 y permite entrar', async () => {
    const harness = createWorkerHarness();
    await harness.createRoomWithCode('ABC123');

    const joinLower = await harness.callWorker('/api/rooms/abc123/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'abc123', playerName: 'Carlos' }),
    });
    expect(joinLower.status).toBe(200);
    const data = (await joinLower.json()) as { success: boolean; roomCode: string };
    expect(data.success).toBe(true);
    expect(data.roomCode).toBe('ABC123');
  });

  it('PRUEBA 6: Alumno intenta unirse a una sala cerrada por el profesor -> ROOM_CLOSED', async () => {
    const harness = createWorkerHarness({ secret: 'sec_close' });
    const { initData } = await harness.createRoomWithCode('CLO123', 'DOC999');

    // Profesor cierra la sala autoritativamente
    const closeRes = await harness.callWorker('/api/rooms/CLO123/teacher-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Teacher-Token': initData.teacherToken,
      },
      body: JSON.stringify({
        teacherToken: initData.teacherToken,
        command: { kind: 'CLOSE_ROOM' },
      }),
    });
    expect(closeRes.status).toBe(200);

    // Alumno intenta unirse tras el cierre (HTTP /join, /state y WS upgrade)
    const joinClosed = await harness.callWorker('/api/rooms/CLO123/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Alumno Tardío' }),
    });
    expect(joinClosed.status).toBe(410);
    expect(((await joinClosed.json()) as { error: string }).error).toBe('ROOM_CLOSED');

    const wsClosed = await harness.callWorker('/ws/CLO123', {
      headers: { Upgrade: 'websocket' },
    });
    expect(wsClosed.status).toBe(410);
    expect(((await wsClosed.json()) as { error: string }).error).toBe('ROOM_CLOSED');
  });

  it('PRUEBA 7: Intentar crear/inicializar una sala usando el endpoint de unión o WS directo es rechazado', async () => {
    const harness = createWorkerHarness();

    // Un alumno intenta POST /api/rooms/HACK99/join con isTeacher=true esperando auto-crear
    const tryCreateViaJoin = await harness.callWorker('/api/rooms/HACK99/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: 'FakeTeacher',
        isTeacher: true,
        teacherPin: '1234',
      }),
    });
    expect(tryCreateViaJoin.status).toBe(404);
    expect(((await tryCreateViaJoin.json()) as { error: string }).error).toBe('ROOM_NOT_FOUND');

    // Intentar mandar JOIN_ROOM directamente por WebSocket contra DO sin /init
    const rec = harness.getRecord('HACK99');
    expect(rec).toBeDefined(); // Se instanció por la llamada, PERO NO está inicializado
    const hijackSock = new MockSocket();
    await rec!.instance.webSocketMessage(
      hijackSock as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'hijack_1',
        playerId: 'attacker',
        playerName: 'Atacante',
      })
    );
    const err = hijackSock.lastMessage();
    expect(err?.type).toBe('ERROR');
    if (err?.type === 'ERROR') {
      expect(err.code).toBe('ROOM_NOT_FOUND');
    }
    expect(hijackSock.closedWith?.code).toBe(1008);
  });

  it('PRUEBA 8: Conexión WebSocket a un código inexistente rechazada ANTES de aceptar el WebSocket', async () => {
    const harness = createWorkerHarness();

    const wsRes = await harness.callWorker('/ws/NOEX99', {
      headers: { Upgrade: 'websocket' },
    });
    // HTTP 404 JSON antes de crear WebSocketPair o devolver 101 Switching Protocols
    expect(wsRes.status).toBe(404);
    const json = (await wsRes.json()) as { success: boolean; error: string; message: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('ROOM_NOT_FOUND');
    expect(json.message).toContain('No existe ninguna partida');
  });

  it('PRUEBA 9: Una unión fallida NO inicializa el Durable Object como partida válida', async () => {
    const harness = createWorkerHarness();

    await harness.callWorker('/api/rooms/FANT99/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Usuario X' }),
    });
    await harness.callWorker('/ws/FANT99', {
      headers: { Upgrade: 'websocket' },
    });
    await harness.callWorker('/api/rooms/FANT99');

    const rec = harness.getRecord('FANT99');
    expect(rec).toBeDefined();
    expect(rec!.storageMap.get('room_initialized')).toBeUndefined();
    expect(rec!.storageMap.get('room_state')).toBeUndefined();
    expect(rec!.storageMap.get('room_code')).toBeUndefined();
  });

  it('PRUEBA 10: Hibernación/reinicio del DO mantiene room_initialized y permite reconexiones válidas', async () => {
    const harness = createWorkerHarness({ secret: 'hib_secret' });
    const { rec, initData } = await harness.createRoomWithCode('HIB999', 'PIN_HIB');

    const j1 = await harness.callWorker('/api/rooms/HIB999/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'stu_hib_1', playerName: 'Elena' }),
    });
    const j1Json = (await j1.json()) as { playerToken: string; playerId: string };
    const ws1 = new MockSocket();
    rec.sockets.push(ws1);
    await rec.instance.webSocketMessage(
      ws1 as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'j_hib_1',
        playerId: j1Json.playerId,
        playerName: 'Elena',
        playerToken: j1Json.playerToken,
      })
    );

    // Profesor inicia la partida (PLAYING)
    await harness.callWorker('/api/rooms/HIB999/teacher-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherToken: initData.teacherToken,
        command: { kind: 'START_GAME' },
      }),
    });

    // Simular hibernación reemplazando la instancia en memoria del DO (misma storageMap)
    rec.instance = new GameRoom(
      {
        storage: {
          get: async <T>(key: string) => rec.storageMap.get(key) as T | undefined,
          put: async (key: string, val: unknown) => {
            rec.storageMap.set(key, val);
          },
        },
        getWebSockets: () => rec.sockets as unknown as WebSocket[],
      } as never,
      { GAME_ROOMS: {} as DurableObjectNamespace, TEACHER_TOKEN_SECRET: 'hib_secret' }
    );

    // Código inexistente sigue siendo rechazado tras reinicio
    const missingAfterHib = await harness.callWorker('/api/rooms/WRONG1/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Otro' }),
    });
    expect(missingAfterHib.status).toBe(404);

    // La jugadora Elena se reconecta tras hibernación y recupera la partida
    const reconRes = await harness.callWorker('/api/rooms/HIB999/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'stu_hib_1',
        playerName: 'Elena',
        playerToken: j1Json.playerToken,
      }),
    });
    expect(reconRes.status).toBe(200);
    const reconJson = (await reconRes.json()) as {
      success: boolean;
      reconnected: boolean;
      state: GameRoomState;
    };
    expect(reconJson.success).toBe(true);
    expect(reconJson.reconnected).toBe(true);
    expect(reconJson.state.status).toBe('playing');
  });

  it('PRUEBA 11: Jugador existente se reconecta en PLAYING/PAUSED, pero nuevo alumno sin permiso recibe ROOM_NOT_JOINABLE y FINISHED -> ROOM_FINISHED', async () => {
    const harness = createWorkerHarness();
    const { rec, initData } = await harness.createRoomWithCode('STA123', 'DOC55', {
      allowLateJoin: false,
    });

    // Registro inicial en LOBBY (WAITING)
    const ws1 = new MockSocket();
    rec.sockets.push(ws1);
    await rec.instance.webSocketMessage(
      ws1 as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'reg_1',
        playerId: 'reg_player_1',
        playerName: 'Marco Polo',
      })
    );

    // Iniciar partida -> pasa a PLAYING
    await harness.callWorker('/api/rooms/STA123/teacher-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherToken: initData.teacherToken,
        command: { kind: 'START_GAME' },
      }),
    });

    // Jugador ya registrado sí puede reconectarse
    const reconPlaying = await harness.callWorker('/api/rooms/STA123/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'otra_pestana', playerName: 'marco polo' }),
    });
    expect(reconPlaying.status).toBe(200);
    const reconData = (await reconPlaying.json()) as { reconnected: boolean; playerId: string };
    expect(reconData.reconnected).toBe(true);
    expect(reconData.playerId).toBe('reg_player_1');

    // Alumno NUEVO no registrado intenta unirse mientras está PLAYING (allowLateJoin=false) -> ROOM_NOT_JOINABLE
    const outsiderRes = await harness.callWorker('/api/rooms/STA123/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'outsider_1', playerName: 'Nuevo Desconocido' }),
    });
    expect(outsiderRes.status).toBe(403);
    expect(((await outsiderRes.json()) as { error: string }).error).toBe('ROOM_NOT_JOINABLE');

    // Finalizar partida -> estado FINISHED -> rechaza nuevas incorporaciones con ROOM_FINISHED
    await harness.callWorker('/api/rooms/STA123/teacher-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherToken: initData.teacherToken,
        command: { kind: 'END_GAME' },
      }),
    });
    const afterEnd = await harness.callWorker('/api/rooms/STA123/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'new_after_end', playerName: 'Tardío Fin' }),
    });
    expect(afterEnd.status).toBe(403);
    expect(((await afterEnd.json()) as { error: string }).error).toBe('ROOM_FINISHED');
  });

  it('PRUEBA 12: 15 alumnos se unen a una misma partida única (ROOM_FULL en #16) y nunca en producción usa fallback local', async () => {
    const harness = createWorkerHarness({ secret: 'cls_15' });
    const createRes = await harness.callWorker('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherPin: 'PROFE15', teacherName: 'Prof. Aula' }),
    });
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as {
      roomCode: string;
      teacherToken: string;
    };

    const rec = harness.getRecord(created.roomCode)!;
    for (let i = 1; i <= 15; i++) {
      const httpJoin = await harness.callWorker(`/api/rooms/${created.roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: `p_${i}`, playerName: `Estudiante ${i}` }),
      });
      expect(httpJoin.status).toBe(200);
      const j = (await httpJoin.json()) as { playerToken: string };

      const sock = new MockSocket();
      rec.sockets.push(sock);
      await rec.instance.webSocketMessage(
        sock as unknown as WebSocket,
        JSON.stringify({
          type: 'JOIN_ROOM',
          actionId: `join_15_${i}`,
          playerId: `p_${i}`,
          playerName: `Estudiante ${i}`,
          playerToken: j.playerToken,
        })
      );
    }

    // Jugador #16 rechazado con ROOM_FULL
    const fullRes = await harness.callWorker(`/api/rooms/${created.roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'p_16', playerName: 'Estudiante 16' }),
    });
    expect(fullRes.status).toBe(409);
    expect(((await fullRes.json()) as { error: string }).error).toBe('ROOM_FULL');

    // Solo existe 1 DO creado para esa partida y los 15 alumnos comparten exactamente esa sala
    expect(harness.namespaces.size).toBe(1);
    const stateRes = await harness.callWorker(`/api/rooms/${created.roomCode}`);
    const stateJson = (await stateRes.json()) as { state: GameRoomState };
    expect(stateJson.state.players.filter((p) => !p.isTeacher)).toHaveLength(15);

    // En producción (*.pages.dev) el fallback local SIEMPRE está desactivado incluso sin definir VITE_ENABLE_LOCAL_FALLBACK
    expect(
      isLocalFallbackEnabled({}, { protocol: 'https:', hostname: 'prl-oca-3d.pages.dev' })
    ).toBe(false);

    // Y si falla la red al verificar la sala en frontend joinRoom, muestra el error explícito sin crear sala local
    const netFailSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network offline'));

    useGameStore.setState({ screen: 'create_join', roomState: null, errorMessage: null });
    await useGameStore.getState().joinRoom({
      roomCode: 'XYZ999',
      playerName: 'Alumno Offline',
    });
    expect(useGameStore.getState().screen).toBe('create_join');
    expect(useGameStore.getState().roomState).toBeNull();
    expect(useGameStore.getState().errorMessage).toBe(
      'No se ha podido verificar la sala. Comprueba tu conexión e inténtalo de nuevo.'
    );
    netFailSpy.mockRestore();
  });
});
