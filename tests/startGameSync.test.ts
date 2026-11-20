import { describe, expect, it, vi } from 'vitest';
import {
  GameRoomState,
  INITIAL_QUESTION_BANK,
  ServerToClientMessage,
  normalizeRoomCode,
} from '@prl-oca/shared';
import workerEntry, { GameRoom } from '../apps/realtime/src/index';
import { useGameStore } from '../apps/web/src/stores/useGameStore';

class MockSocket {
  public inbox: ServerToClientMessage[] = [];
  private attachment: unknown = undefined;

  public send(payload: string): void {
    this.inbox.push(JSON.parse(payload) as ServerToClientMessage);
  }

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

  public lastMessage(): ServerToClientMessage | undefined {
    return this.inbox[this.inbox.length - 1];
  }
}

function createHibernationMockState(sockets: MockSocket[]) {
  const storageMap = new Map<string, unknown>();
  return {
    storageMap,
    ctx: {
      storage: {
        get: async <T>(key: string) => storageMap.get(key) as T | undefined,
        put: async (key: string, val: unknown) => {
          storageMap.set(key, val);
        },
      },
      getWebSockets: () => sockets as unknown as WebSocket[],
    },
  };
}

async function createAndJoinRoom(params: {
  roomCode: string;
  teacherPin: string;
  studentCount: number;
  maxPlayers?: number;
  allowLateJoin?: boolean;
  secret?: string;
}) {
  const sockets: MockSocket[] = [];
  const { storageMap, ctx } = createHibernationMockState(sockets);
  const env = {
    GAME_ROOMS: {} as DurableObjectNamespace,
    TEACHER_TOKEN_SECRET: params.secret,
  };
  const room = new GameRoom(ctx as never, env);

  const initRes = await room.fetch(
    new Request(`https://internal/init?roomCode=${params.roomCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: params.roomCode,
        teacherPin: params.teacherPin,
        config: {
          mode: 'teams',
          teamCount: 3,
          maxPlayers: params.maxPlayers ?? 15,
          allowLateJoin: params.allowLateJoin ?? false,
        },
      }),
    })
  );
  const initData = (await initRes.json()) as {
    ok: boolean;
    roomCode: string;
    teacherToken: string;
    state: GameRoomState;
  };

  const teacherSock = new MockSocket();
  sockets.push(teacherSock);
  await room.webSocketMessage(
    teacherSock as unknown as WebSocket,
    JSON.stringify({
      type: 'JOIN_ROOM',
      actionId: 'join_teacher',
      playerId: 'teacher_main',
      playerName: 'Prof. PRL',
      isTeacher: true,
      teacherPin: params.teacherPin,
    })
  );

  const studentSocks: MockSocket[] = [];
  for (let i = 1; i <= params.studentCount; i++) {
    const sSock = new MockSocket();
    sockets.push(sSock);
    studentSocks.push(sSock);
    await room.webSocketMessage(
      sSock as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: `join_stu_${i}`,
        playerId: `stu_${i}`,
        playerName: `Alumno ${i}`,
      })
    );
  }

  return {
    room,
    ctx,
    env,
    storageMap,
    sockets,
    teacherSock,
    studentSocks,
    roomCode: initData.roomCode,
    teacherToken: initData.teacherToken,
  };
}

describe('Sincronización INICIAR PARTIDA entre Profesor, Alumnos y Cloudflare Worker/DO (Pruebas 1-7)', () => {
  it('PRUEBA 1: 1 profesor + 1 alumno inician partida y reciben GAME_STARTED + STATE_SYNC simultáneamente (backend + frontend store)', async () => {
    const setup = await createAndJoinRoom({
      roomCode: 'SYNC01',
      teacherPin: 'PIN2026',
      studentCount: 1,
      secret: 'secret_key_test',
    });

    // Ambos ven estado lobby antes de pulsar Iniciar Partida
    expect(setup.studentSocks[0].messagesOfType('STATE_SYNC').slice(-1)[0]?.state.status).toBe(
      'lobby'
    );

    // Profesor envía START_GAME
    await setup.room.webSocketMessage(
      setup.teacherSock as unknown as WebSocket,
      JSON.stringify({
        type: 'TEACHER_ACTION',
        actionId: 'act_start_1v1',
        teacherToken: setup.teacherToken,
        command: { kind: 'START_GAME' },
      })
    );

    for (const sock of [setup.teacherSock, ...setup.studentSocks]) {
      const startedMsgs = sock.messagesOfType('GAME_STARTED');
      expect(startedMsgs.length).toBeGreaterThanOrEqual(1);
      const started = startedMsgs[startedMsgs.length - 1];
      expect(started.roomCode).toBe('SYNC01');
      expect(started.startedAt).toBeGreaterThan(0);
      expect(started.state.status).toBe('playing');
      expect(started.state.phase).toBe('waiting_roll');

      const syncMsg = sock.messagesOfType('STATE_SYNC').slice(-1)[0];
      expect(syncMsg?.state.status).toBe('playing');
    }

    // Verificar transición real en frontend Zustand store del alumno
    const studentStartedPayload = setup.studentSocks[0].messagesOfType('GAME_STARTED')[0];
    useGameStore.setState({
      screen: 'lobby',
      isTeacher: false,
      isRemoteSession: true,
      connectionStatus: 'connected',
      playerId: 'stu_1',
      roomState: { ...studentStartedPayload.state, status: 'lobby' },
      errorMessage: null,
    });

    useGameStore.getState().applyServerMessage(studentStartedPayload);

    expect(useGameStore.getState().screen).toBe('game');
    expect(useGameStore.getState().roomState?.status).toBe('playing');
    expect(useGameStore.getState().roomState?.turnNumber).toBe(1);
    expect(useGameStore.getState().roomState?.teams[0]?.id).toBe('team_1');
  });

  it('PRUEBA 2: 1 profesor + 3 alumnos simultáneos pasan a PLAYING y tablero 3D al iniciar', async () => {
    const setup = await createAndJoinRoom({
      roomCode: 'SYNC03',
      teacherPin: 'PIN2026',
      studentCount: 3,
    });

    await setup.room.webSocketMessage(
      setup.teacherSock as unknown as WebSocket,
      JSON.stringify({
        type: 'TEACHER_ACTION',
        actionId: 'act_start_3',
        teacherToken: setup.teacherToken,
        command: { kind: 'START_GAME' },
      })
    );

    expect(setup.studentSocks).toHaveLength(3);
    for (const sock of [setup.teacherSock, ...setup.studentSocks]) {
      const started = sock.messagesOfType('GAME_STARTED').slice(-1)[0];
      expect(started).toBeDefined();
      expect(started.state.status).toBe('playing');
      expect(started.state.players.filter((p) => !p.isTeacher)).toHaveLength(3);
    }
  });

  it('PRUEBA 3: 1 profesor + 15 alumnos simultáneos (3x5) reciben GAME_STARTED con roles inicializados', async () => {
    const setup = await createAndJoinRoom({
      roomCode: 'SYNC15',
      teacherPin: 'PIN2026',
      studentCount: 15,
    });

    await setup.room.webSocketMessage(
      setup.teacherSock as unknown as WebSocket,
      JSON.stringify({
        type: 'TEACHER_ACTION',
        actionId: 'act_start_15',
        teacherToken: setup.teacherToken,
        command: { kind: 'START_GAME' },
      })
    );

    for (const sock of [setup.teacherSock, ...setup.studentSocks]) {
      const started = sock.messagesOfType('GAME_STARTED').slice(-1)[0];
      expect(started?.state.status).toBe('playing');
      expect(started?.state.startedAt).toBeGreaterThan(0);
      for (const team of started.state.teams) {
        expect(team.currentRoles).toHaveLength(5);
      }
    }
  });

  it('PRUEBA 4: Alumno que se une tarde cuando el profesor habilitó incorporaciones tardías entra directamente al tablero', async () => {
    const setup = await createAndJoinRoom({
      roomCode: 'LATE01',
      teacherPin: 'PIN2026',
      studentCount: 1,
      allowLateJoin: true,
    });

    // Inicia primero con 1 alumno
    await setup.room.webSocketMessage(
      setup.teacherSock as unknown as WebSocket,
      JSON.stringify({
        type: 'TEACHER_ACTION',
        actionId: 'act_start_early',
        teacherToken: setup.teacherToken,
        command: { kind: 'START_GAME' },
      })
    );

    // Alumno tardío se conecta después de START_GAME
    const lateSocket = new MockSocket();
    setup.sockets.push(lateSocket);
    await setup.room.webSocketMessage(
      lateSocket as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'act_late_join',
        playerId: 'stu_late',
        playerName: 'Alumno Tardío',
      })
    );

    const lateStarted = lateSocket.messagesOfType('GAME_STARTED').slice(-1)[0];
    const lateSync = lateSocket.messagesOfType('STATE_SYNC').slice(-1)[0];
    expect(lateStarted?.state.status).toBe('playing');
    expect(lateSync?.state.status).toBe('playing');
    expect(lateSync?.yourPlayerId).toBe('stu_late');

    useGameStore.setState({
      screen: 'create_join',
      isTeacher: false,
      isRemoteSession: true,
      playerId: 'stu_late',
      roomState: null,
    });
    useGameStore.getState().applyServerMessage(lateSync!);
    expect(useGameStore.getState().screen).toBe('game');
  });

  it('PRUEBA 5: Desconexión, hibernación del Durable Object y comando HTTP fallback sincronizan a todos', async () => {
    const setup = await createAndJoinRoom({
      roomCode: 'HIB01',
      teacherPin: 'PIN2026',
      studentCount: 2,
      secret: 'prod_secret_123',
    });

    // Alumno 1 se desconecta antes de iniciar la partida
    await setup.room.webSocketClose(setup.studentSocks[0] as unknown as WebSocket);
    setup.sockets.splice(setup.sockets.indexOf(setup.studentSocks[0]), 1);

    // Simular despertar del Durable Object tras hibernación (nueva instancia leyendo misma storage + getWebSockets)
    const wokenRoom = new GameRoom(setup.ctx as never, setup.env);

    // Profesor perdió momentáneamente WS y usa POST /teacher-action HTTP mientras Alumno 2 sigue conectado por WS
    const httpRes = await wokenRoom.fetch(
      new Request('https://internal/teacher-action?roomCode=HIB01', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Teacher-Token': setup.teacherToken,
        },
        body: JSON.stringify({
          teacherToken: setup.teacherToken,
          command: { kind: 'START_GAME' },
        }),
      })
    );
    expect(httpRes.status).toBe(200);
    const httpJson = (await httpRes.json()) as {
      ok: boolean;
      gameStarted: boolean;
      state: GameRoomState;
    };
    expect(httpJson.ok).toBe(true);
    expect(httpJson.gameStarted).toBe(true);
    expect(httpJson.state.status).toBe('playing');

    // Alumno 2 conectado recibió GAME_STARTED por WebSocket desde el DO despierto tras hibernación
    const stu2Started = setup.studentSocks[1].messagesOfType('GAME_STARTED').slice(-1)[0];
    expect(stu2Started?.state.status).toBe('playing');

    // Alumno 1 se reconecta después del inicio y recibe directamente estado PLAYING
    const reconnectedStu1Sock = new MockSocket();
    setup.sockets.push(reconnectedStu1Sock);
    await wokenRoom.webSocketMessage(
      reconnectedStu1Sock as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'act_stu1_reconnect',
        playerId: 'stu_1',
        playerName: 'Alumno 1',
      })
    );
    const reconStarted = reconnectedStu1Sock.messagesOfType('GAME_STARTED').slice(-1)[0];
    const reconSync = reconnectedStu1Sock.messagesOfType('STATE_SYNC').slice(-1)[0];
    expect(reconStarted?.state.status).toBe('playing');
    expect(reconSync?.state.players.find((p) => p.id === 'stu_1')?.connected).toBe(true);
  });

  it('PRUEBA 6: Un alumno sin autorización de profesor NO puede iniciar la partida', async () => {
    const setup = await createAndJoinRoom({
      roomCode: 'AUTH01',
      teacherPin: 'PIN_SECRETO',
      studentCount: 1,
      secret: 'server_secret',
    });

    await setup.room.webSocketMessage(
      setup.studentSocks[0] as unknown as WebSocket,
      JSON.stringify({
        type: 'TEACHER_ACTION',
        actionId: 'act_stu_hijack_start',
        teacherToken: 'token_falso_de_alumno',
        command: { kind: 'START_GAME' },
      })
    );

    const errMsg = setup.studentSocks[0].lastMessage();
    expect(errMsg?.type).toBe('ERROR');
    if (errMsg?.type === 'ERROR') {
      expect(errMsg.code).toBe('UNAUTHORIZED_TEACHER');
    }

    // Y por HTTP tampoco puede sin token válido
    const forbiddenHttp = await setup.room.fetch(
      new Request('https://internal/teacher-action?roomCode=AUTH01', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherToken: 'pin_inventado',
          command: { kind: 'START_GAME' },
        }),
      })
    );
    expect(forbiddenHttp.status).toBe(401);

    // La sala permanece intacta en estado lobby
    const stateRes = await setup.room.fetch(new Request('https://internal/state?roomCode=AUTH01'));
    const stateJson = (await stateRes.json()) as { state: GameRoomState };
    expect(stateJson.state.status).toBe('lobby');
  });

  it('PRUEBA 7: Doble clic en INICIAR PARTIDA es idempotente, normaliza roomCode en Worker y bloquea inicio falso offline si es sala remota', async () => {
    // 7A. Worker routing normaliza espacios/minúsculas al mismo idFromName
    const routedRoomNames: string[] = [];
    const sockets: MockSocket[] = [];
    const { ctx } = createHibernationMockState(sockets);
    let roomInstance: GameRoom | null = null;
    const mockEnv = {
      ENVIRONMENT: 'development',
      ALLOWED_ORIGIN: '*',
      GAME_ROOMS: {
        idFromName: (name: string) => {
          routedRoomNames.push(name);
          return name as unknown as DurableObjectId;
        },
        get: (id: DurableObjectId) => {
          if (!roomInstance) {
            roomInstance = new GameRoom(ctx as never, {
              GAME_ROOMS: {} as DurableObjectNamespace,
            });
          }
          return {
            fetch: (req: Request) => {
              void id;
              return roomInstance!.fetch(req);
            },
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

    expect(normalizeRoomCode('  prl-99x  ')).toBe('PRL-99X');
    const createRes = await workerEntry.fetch(
      new Request('https://worker.test/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherPin: 'DOC999',
          teacherName: 'Docente Test',
        }),
      }),
      mockEnv as never
    );
    const created = (await createRes.json()) as {
      ok: boolean;
      roomCode: string;
      teacherToken: string;
    };
    expect(created.ok).toBe(true);

    // Consulta con minúsculas y espacios URL-encoded -> mismo DO
    const getLowerRes = await workerEntry.fetch(
      new Request(`https://worker.test/api/rooms/%20${created.roomCode.toLowerCase()}%20`),
      mockEnv as never
    );
    expect(getLowerRes.status).toBe(200);
    expect(routedRoomNames[0]).toBe(created.roomCode);
    expect(routedRoomNames[1]).toBe(created.roomCode);

    // 7B. Conectar profesor + 1 alumno en ese DO y probar doble clic START_GAME
    const tSock = new MockSocket();
    const sSock = new MockSocket();
    sockets.push(tSock, sSock);
    await roomInstance!.webSocketMessage(
      tSock as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 't_join_7',
        playerId: 't_7',
        playerName: 'Docente',
        isTeacher: true,
        teacherPin: 'DOC999',
      })
    );
    await roomInstance!.webSocketMessage(
      sSock as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 's_join_7',
        playerId: 's_7',
        playerName: 'Alumno 7',
      })
    );

    await roomInstance!.webSocketMessage(
      tSock as unknown as WebSocket,
      JSON.stringify({
        type: 'TEACHER_ACTION',
        actionId: 'start_click_1',
        teacherToken: created.teacherToken,
        command: { kind: 'START_GAME' },
      })
    );

    const afterFirst = sSock.messagesOfType('GAME_STARTED').slice(-1)[0];
    const firstStartedAt = afterFirst.startedAt;
    const logsCountAfterFirst = afterFirst.state.logs.length;

    // Segundo clic con otro actionId (simulando doble pulsación)
    await roomInstance!.webSocketMessage(
      tSock as unknown as WebSocket,
      JSON.stringify({
        type: 'TEACHER_ACTION',
        actionId: 'start_click_2',
        teacherToken: created.teacherToken,
        command: { kind: 'START_GAME' },
      })
    );

    const stateCheck = await workerEntry.fetch(
      new Request(`https://worker.test/api/rooms/${created.roomCode}`),
      mockEnv as never
    );
    const finalJson = (await stateCheck.json()) as { state: GameRoomState };
    expect(finalJson.state.status).toBe('playing');
    expect(finalJson.state.startedAt).toBe(firstStartedAt);
    expect(finalJson.state.players.filter((p) => !p.isTeacher)).toHaveLength(1);
    expect(finalJson.state.logs.length).toBe(logsCountAfterFirst);

    // 7C. Frontend store: si es sesión remota y WS está desconectado, NO finge partida local ante fallo del servidor
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: 'Servidor temporalmente ocupado' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    useGameStore.setState({
      screen: 'lobby',
      isTeacher: true,
      isRemoteSession: true,
      connectionStatus: 'disconnected',
      teacherToken: created.teacherToken,
      roomState: { ...finalJson.state, status: 'lobby' },
      errorMessage: null,
    });

    await useGameStore.getState().runTeacherCommand({ kind: 'START_GAME' });
    expect(useGameStore.getState().screen).toBe('lobby');
    expect(useGameStore.getState().roomState?.status).toBe('lobby');
    expect(useGameStore.getState().errorMessage).toContain('Servidor temporalmente ocupado');
    fetchSpy.mockRestore();
  });
});
