import { describe, expect, it, vi } from 'vitest';
import {
  GameRoomState,
  INITIAL_QUESTION_BANK,
  ServerToClientMessage,
  getRoomParticipantStats,
} from '@prl-oca/shared';
import workerEntry, { GameRoom } from '../apps/realtime/src/index';
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

function createWorkerHarness(options?: { secret?: string }) {
  const namespaces = new Map<string, SimulatedDORecord>();

  const buildInstance = (
    ctx: SimulatedDORecord['ctx'],
    sockets: MockSocket[],
    roomCode: string
  ) =>
    new GameRoom(ctx as never, {
      GAME_ROOMS: {} as DurableObjectNamespace,
      TEACHER_TOKEN_SECRET: options?.secret,
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
      instance: buildInstance(ctx, sockets, name),
    };
    namespaces.set(name, rec);
    return rec;
  };

  const env = {
    ENVIRONMENT: 'production',
    ALLOWED_ORIGIN: 'https://prl-oca-3d.pages.dev',
    TEACHER_TOKEN_SECRET: options?.secret ?? 'test-secret-identity-sync',
    GAME_ROOMS: {
      idFromName: (name: string) => name as unknown as DurableObjectId,
      get: (id: DurableObjectId) => {
        const key = String(id);
        return {
          fetch: (req: Request) => getOrCreateRecord(key).instance.fetch(req),
        } as unknown as DurableObjectStub;
      },
    },
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
        all: async () => ({ results: INITIAL_QUESTION_BANK.slice(0, 1) }),
      }),
    },
  };

  return {
    env,
    getRecord: (code: string) => namespaces.get(code.toUpperCase()),
    hibernateAndWakeDO: (code: string): SimulatedDORecord => {
      const rec = getOrCreateRecord(code.toUpperCase());
      // Simula hibernación en Cloudflare DO: nueva instancia en memoria manteniendo storageMap + getWebSockets()
      rec.instance = buildInstance(rec.ctx, rec.sockets, rec.roomCode);
      return rec;
    },
    httpFetch: (path: string, init?: RequestInit) =>
      workerEntry.fetch(
        new Request(`https://prl-oca-realtime.workers.dev${path}`, {
          ...init,
          headers: {
            Origin: 'https://prl-oca-3d.pages.dev',
            ...(init?.headers ?? {}),
          },
        }),
        env as never
      ),
    connectSocket: async (
      roomCode: string,
      joinMsg: Record<string, unknown>
    ): Promise<MockSocket> => {
      const rec = getOrCreateRecord(roomCode.toUpperCase());
      const sock = new MockSocket();
      rec.sockets.push(sock);
      await rec.instance.webSocketMessage(
        sock as unknown as WebSocket,
        JSON.stringify(joinMsg)
      );
      return sock;
    },
    closeSocket: async (roomCode: string, sock: MockSocket): Promise<void> => {
      const rec = getOrCreateRecord(roomCode.toUpperCase());
      const idx = rec.sockets.indexOf(sock);
      if (idx >= 0) {
        rec.sockets.splice(idx, 1);
      }
      await rec.instance.webSocketClose(sock as unknown as WebSocket);
    },
    sendWsMessage: async (
      roomCode: string,
      sock: MockSocket,
      msg: Record<string, unknown>
    ): Promise<void> => {
      const rec = getOrCreateRecord(roomCode.toUpperCase());
      await rec.instance.webSocketMessage(sock as unknown as WebSocket, JSON.stringify(msg));
    },
  };
}

async function createRoomViaHttp(
  harness: ReturnType<typeof createWorkerHarness>,
  overrides?: Record<string, unknown>
) {
  const res = await harness.httpFetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherPin: 'PIN2026',
      teacherName: 'Prof. Prevención',
      config: {
        roomName: 'Aula PRL Identidad',
        mode: 'teams',
        teamCount: 2,
        maxPlayers: 15,
        diceMode: '1d6',
      },
      ...overrides,
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    roomCode: string;
    playerId: string;
    playerToken: string;
    teacherToken: string;
    state: GameRoomState;
  };
  return { res, data };
}

async function joinRoomViaHttp(
  harness: ReturnType<typeof createWorkerHarness>,
  roomCode: string,
  payload: Record<string, unknown>
) {
  const res = await harness.httpFetch(`/api/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    message?: string;
    roomCode?: string;
    playerId?: string;
    playerToken?: string;
    teacherToken?: string;
    reconnected?: boolean;
    state?: GameRoomState;
  };
  return { res, data };
}

describe('Identidad Unificada de Participantes, Contabilización y Autorización de Acciones (Pruebas 1-12)', () => {
  it('PRUEBA 1: Profesor crea partida -> recibe playerId, teacherToken y playerToken válidos y queda registrado en servidor', async () => {
    const harness = createWorkerHarness();
    const { res, data } = await createRoomViaHttp(harness);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.roomCode).toHaveLength(6);
    expect(data.playerId).toBeTruthy();
    expect(data.playerToken).toBeTruthy();
    expect(data.teacherToken).toBeTruthy();

    const teacherInState = data.state.players.find((p) => p.id === data.playerId);
    expect(teacherInState).toBeDefined();
    expect(teacherInState?.isTeacher).toBe(true);
    expect(teacherInState?.connected).toBe(true);

    const stats = getRoomParticipantStats(data.state);
    expect(stats.teacherConnected).toBe(true);
    expect(stats.registeredCount).toBe(0);
    expect(stats.connectedCount).toBe(0);
    expect(stats.maxPlayers).toBe(15);
  });

  it('PRUEBA 2: Alumno entra en partida -> recibe playerId único y playerToken y queda registrado en el servidor', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);

    const { res, data: joinData } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Lucía Operaria',
    });

    expect(res.status).toBe(200);
    expect(joinData.ok).toBe(true);
    expect(joinData.playerId).toBeTruthy();
    expect(joinData.playerId).not.toBe(roomData.playerId);
    expect(joinData.playerToken).toBeTruthy();
    expect(joinData.state).toBeDefined();

    const studentInState = joinData.state!.players.find((p) => p.id === joinData.playerId);
    expect(studentInState).toBeDefined();
    expect(studentInState?.name).toBe('Lucía Operaria');
    expect(studentInState?.isTeacher).toBe(false);
    expect(studentInState?.teamId).toBeTruthy();
    expect(studentInState?.connected).toBe(true);
  });

  it('PRUEBA 3: Profesor + 1 Alumno conectados -> contador real es 1/15 (no 0/15) y actualiza al desconectarse', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);
    const { data: studentJoin } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Carlos PRL',
    });

    const teacherSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_t_1',
      playerId: roomData.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherPin: 'PIN2026',
      teacherToken: roomData.teacherToken,
      playerToken: roomData.playerToken,
    });
    const studentSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_s_1',
      playerId: studentJoin.playerId,
      playerName: 'Carlos PRL',
      playerToken: studentJoin.playerToken,
    });

    const latestTeacherSync = teacherSock.messagesOfType('STATE_SYNC').slice(-1)[0];
    expect(latestTeacherSync).toBeDefined();
    const statsConnected = getRoomParticipantStats(latestTeacherSync!.state);
    expect(statsConnected.registeredCount).toBe(1);
    expect(statsConnected.connectedCount).toBe(1);
    expect(statsConnected.disconnectedCount).toBe(0);
    expect(statsConnected.teacherConnected).toBe(true);
    expect(statsConnected.maxPlayers).toBe(15);

    // Al cerrar el WebSocket del alumno pasa inmediatamente a 0 conectados / 1 registrado desconectado
    await harness.closeSocket(roomData.roomCode, studentSock);
    const afterCloseSync = teacherSock.messagesOfType('STATE_SYNC').slice(-1)[0];
    const statsAfterDisconnect = getRoomParticipantStats(afterCloseSync!.state);
    expect(statsAfterDisconnect.registeredCount).toBe(1);
    expect(statsAfterDisconnect.connectedCount).toBe(0);
    expect(statsAfterDisconnect.disconnectedCount).toBe(1);
    expect(statsAfterDisconnect.teacherConnected).toBe(true);
  });

  it('PRUEBA 4: Profesor registrado (admin y jugador-docente sin duplicarse) lanza el dado autorizado sin error de reconocimiento', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness, {
      teacherParticipatesAsPlayer: true,
    });
    const { data: studentJoin } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Elena PRL',
    });

    const teacherSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_teacher_play',
      playerId: roomData.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherToken: roomData.teacherToken,
      playerToken: roomData.playerToken,
      participatesAsPlayer: true,
    });
    await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_stu_play',
      playerId: studentJoin.playerId,
      playerName: 'Elena PRL',
      playerToken: studentJoin.playerToken,
    });

    // Verificar que el profesor jugador se contabiliza UNA SOLA VEZ junto con el alumno (= 2)
    const preStartSync = teacherSock.messagesOfType('STATE_SYNC').slice(-1)[0]!;
    const statsWithPlayingTeacher = getRoomParticipantStats(preStartSync.state);
    expect(statsWithPlayingTeacher.registeredCount).toBe(2);
    expect(statsWithPlayingTeacher.connectedCount).toBe(2);
    expect(statsWithPlayingTeacher.teacherConnected).toBe(true);
    expect(
      preStartSync.state.players.filter((p) => p.id === roomData.playerId).length
    ).toBe(1);

    // Iniciar partida y permitir al profesor lanzar dado vía WS autenticado
    await harness.sendWsMessage(roomData.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'start_p4',
      teacherToken: roomData.teacherToken,
      command: { kind: 'START_GAME' },
    });

    await harness.sendWsMessage(roomData.roomCode, teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'roll_teacher_ws',
      playerId: roomData.playerId,
      playerToken: roomData.playerToken,
    });

    const errMsgs = teacherSock.messagesOfType('ERROR');
    expect(errMsgs).toHaveLength(0);
    const rolledMsgs = teacherSock.messagesOfType('DICE_ROLLED');
    expect(rolledMsgs).toHaveLength(1);
    expect(rolledMsgs[0].roll.dice.length).toBeGreaterThanOrEqual(1);
    expect(rolledMsgs[0].roll.rolledByPlayerId).toBe(roomData.playerId);

    // También comprobar profesor estándar (participatesAsPlayer=false) lanzando dado vía HTTP /action
    const { data: adminRoom } = await createRoomViaHttp(harness);
    const { data: adminStu } = await joinRoomViaHttp(harness, adminRoom.roomCode, {
      playerName: 'Alumno AdminTest',
    });
    expect(getRoomParticipantStats(adminStu.state!).registeredCount).toBe(1);
    const adminTeacherSock = await harness.connectSocket(adminRoom.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_t_admin',
      playerId: adminRoom.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherToken: adminRoom.teacherToken,
      playerToken: adminRoom.playerToken,
    });
    await harness.sendWsMessage(adminRoom.roomCode, adminTeacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'start_admin',
      teacherToken: adminRoom.teacherToken,
      command: { kind: 'START_GAME' },
    });
    const adminRollHttp = await harness.httpFetch(`/api/rooms/${adminRoom.roomCode}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'roll_admin_http',
        playerId: adminRoom.playerId,
        playerToken: adminRoom.playerToken,
      }),
    });
    expect(adminRollHttp.status).toBe(200);
    const adminRollJson = (await adminRollHttp.json()) as { ok: boolean; error?: string };
    expect(adminRollJson.ok).toBe(true);
  });

  it('PRUEBA 5: Alumno autorizado lanza dado en su turno y se retransmite DICE_ROLLED a todos los clientes', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);
    const { data: studentJoin } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Mateo PRL',
    });

    const teacherSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_t_5',
      playerId: roomData.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherToken: roomData.teacherToken,
      playerToken: roomData.playerToken,
    });
    const studentSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_s_5',
      playerId: studentJoin.playerId,
      playerName: 'Mateo PRL',
      playerToken: studentJoin.playerToken,
    });

    await harness.sendWsMessage(roomData.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'start_5',
      teacherToken: roomData.teacherToken,
      command: { kind: 'START_GAME' },
    });

    await harness.sendWsMessage(roomData.roomCode, studentSock, {
      type: 'ROLL_DICE',
      actionId: 'roll_student_5',
      playerId: studentJoin.playerId,
      playerToken: studentJoin.playerToken,
    });

    expect(studentSock.messagesOfType('ERROR')).toHaveLength(0);
    expect(studentSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    const studentRollMsg = studentSock.messagesOfType('DICE_ROLLED')[0]!;
    expect(studentRollMsg.roll.rolledByPlayerId).toBe(studentJoin.playerId);
    expect(studentRollMsg.roll.total).toBeGreaterThanOrEqual(1);
    expect(studentRollMsg.state.logs.some((l) => l.message.includes('Mateo PRL'))).toBe(true);
  });

  it('PRUEBA 6: Alumno que intenta lanzar fuera de turno recibe rechazo limpio de turno (nunca "Jugador no reconocido")', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);
    const { data: s1 } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Alumno Equipo 1',
    });
    const { data: s2 } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Alumno Equipo 2',
    });

    const teacherSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_t_6',
      playerId: roomData.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherToken: roomData.teacherToken,
      playerToken: roomData.playerToken,
    });
    const sock1 = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_s1_6',
      playerId: s1.playerId,
      playerName: 'Alumno Equipo 1',
      playerToken: s1.playerToken,
    });
    const sock2 = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_s2_6',
      playerId: s2.playerId,
      playerName: 'Alumno Equipo 2',
      playerToken: s2.playerToken,
    });

    await harness.sendWsMessage(roomData.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'start_6',
      teacherToken: roomData.teacherToken,
      command: { kind: 'START_GAME' },
    });

    const startedState = sock1.messagesOfType('GAME_STARTED')[0]!.state;
    const activeTeamId = startedState.teams[startedState.activeTeamIndex].id;
    const outOfTurn =
      startedState.players.find((p) => p.id === s2.playerId)?.teamId !== activeTeamId
        ? { data: s2, sock: sock2 }
        : { data: s1, sock: sock1 };

    await harness.sendWsMessage(roomData.roomCode, outOfTurn.sock, {
      type: 'ROLL_DICE',
      actionId: 'roll_oot_6',
      playerId: outOfTurn.data.playerId,
      playerToken: outOfTurn.data.playerToken,
    });

    const err = outOfTurn.sock.messagesOfType('ERROR').slice(-1)[0];
    expect(err).toBeDefined();
    expect(err?.message).toContain('Es el turno del');
    expect(err?.message).not.toContain('no reconocido');
    expect(outOfTurn.sock.messagesOfType('DICE_ROLLED')).toHaveLength(0);

    // Store debe desbloquear isRollingAnimation al recibir ERROR
    useGameStore.setState({ isRollingAnimation: true, errorMessage: null });
    useGameStore.getState().applyServerMessage(err!);
    expect(useGameStore.getState().isRollingAnimation).toBe(false);
    expect(useGameStore.getState().errorMessage).toContain('Es el turno del');
  });

  it('PRUEBA 7: Alumno desconectado vuelve a entrar y recupera identidad, token y equipo sin duplicarse', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);
    const { data: join1 } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Sofía PRL',
    });

    const sock1 = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_re_1',
      playerId: join1.playerId,
      playerName: 'Sofía PRL',
      playerToken: join1.playerToken,
    });
    const originalTeamId = join1.state!.players.find((p) => p.id === join1.playerId)?.teamId;

    await harness.closeSocket(roomData.roomCode, sock1);

    // Reconexión con playerId + playerToken previos
    const { res: rejoinRes, data: rejoinData } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerId: join1.playerId,
      playerToken: join1.playerToken,
      playerName: 'Sofía PRL',
    });
    expect(rejoinRes.status).toBe(200);
    expect(rejoinData.reconnected).toBe(true);
    expect(rejoinData.playerId).toBe(join1.playerId);

    const sock2 = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_re_2',
      playerId: join1.playerId,
      playerName: 'Sofía PRL',
      playerToken: rejoinData.playerToken,
    });

    const latestSync = sock2.messagesOfType('STATE_SYNC').slice(-1)[0]!;
    const matches = latestSync.state.players.filter((p) => p.id === join1.playerId);
    expect(matches).toHaveLength(1);
    expect(matches[0].connected).toBe(true);
    expect(matches[0].teamId).toBe(originalTeamId);
    expect(getRoomParticipantStats(latestSync.state).registeredCount).toBe(1);
    expect(getRoomParticipantStats(latestSync.state).connectedCount).toBe(1);
  });

  it('PRUEBA 8: Alumno con 2 pestañas abiertas mantiene connectedCount=1 sin duplicar y sigue conectado al cerrar 1 pestaña', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);
    const { data: join1 } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'David PRL',
    });

    const tab1 = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_tab_1',
      playerId: join1.playerId,
      playerName: 'David PRL',
      playerToken: join1.playerToken,
    });
    const tab2 = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_tab_2',
      playerId: join1.playerId,
      playerName: 'David PRL',
      playerToken: join1.playerToken,
    });

    const syncTwoTabs = tab2.messagesOfType('STATE_SYNC').slice(-1)[0]!;
    expect(syncTwoTabs.state.players.filter((p) => !p.isTeacher && !p.isSpectator)).toHaveLength(1);
    expect(getRoomParticipantStats(syncTwoTabs.state).connectedCount).toBe(1);

    // Cerrar una sola pestaña -> sigue conectado en la segunda
    await harness.closeSocket(roomData.roomCode, tab1);
    const syncAfterOneTabClosed = tab2.messagesOfType('STATE_SYNC').slice(-1)[0]!;
    expect(getRoomParticipantStats(syncAfterOneTabClosed.state).connectedCount).toBe(1);
    expect(
      syncAfterOneTabClosed.state.players.find((p) => p.id === join1.playerId)?.connected
    ).toBe(true);

    // Cerrar última pestaña -> pasa a desconectado
    await harness.closeSocket(roomData.roomCode, tab2);
    const rec = harness.getRecord(roomData.roomCode)!;
    const resState = await harness.httpFetch(`/api/rooms/${roomData.roomCode}`);
    const polled = (await resState.json()) as { state: GameRoomState };
    expect(getRoomParticipantStats(polled.state).connectedCount).toBe(0);
    expect(getRoomParticipantStats(polled.state).disconnectedCount).toBe(1);
    expect(rec.sockets).toHaveLength(0);
  });

  it('PRUEBA 9: 15 alumnos se conectan simultáneamente -> 15 identidades únicas y contador real 15/15', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);

    const teacherSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_t_15',
      playerId: roomData.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherToken: roomData.teacherToken,
      playerToken: roomData.playerToken,
    });

    const studentIds = new Set<string>();
    for (let i = 1; i <= 15; i++) {
      const { res, data } = await joinRoomViaHttp(harness, roomData.roomCode, {
        playerName: `Alumno ${i}`,
      });
      expect(res.status).toBe(200);
      expect(data.playerId).toBeTruthy();
      expect(data.playerToken).toBeTruthy();
      studentIds.add(data.playerId!);

      await harness.connectSocket(roomData.roomCode, {
        type: 'JOIN_ROOM',
        actionId: `ws_15_${i}`,
        playerId: data.playerId,
        playerName: `Alumno ${i}`,
        playerToken: data.playerToken,
      });
    }

    expect(studentIds.size).toBe(15);
    const finalSync = teacherSock.messagesOfType('STATE_SYNC').slice(-1)[0]!;
    const stats = getRoomParticipantStats(finalSync.state);
    expect(stats.registeredCount).toBe(15);
    expect(stats.connectedCount).toBe(15);
    expect(stats.disconnectedCount).toBe(0);
    expect(stats.maxPlayers).toBe(15);
    expect(stats.teacherConnected).toBe(true);
  });

  it('PRUEBA 10: Usuario no autorizado intenta enviar acción con playerId inventado -> servidor rechaza explícitamente', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);
    const { data: studentJoin } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Legítimo PRL',
    });

    const teacherSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_t_10',
      playerId: roomData.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherToken: roomData.teacherToken,
      playerToken: roomData.playerToken,
    });
    const studentSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_s_10',
      playerId: studentJoin.playerId,
      playerName: 'Legítimo PRL',
      playerToken: studentJoin.playerToken,
    });

    await harness.sendWsMessage(roomData.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'start_10',
      teacherToken: roomData.teacherToken,
      command: { kind: 'START_GAME' },
    });

    // Intento 1: socket sin JOIN_ROOM ni token usando playerId inventado
    const rec = harness.getRecord(roomData.roomCode)!;
    const rogueSock = new MockSocket();
    rec.sockets.push(rogueSock);
    await rec.instance.webSocketMessage(
      rogueSock as unknown as WebSocket,
      JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'forged_ws_10',
        playerId: 'plr_inventado_999',
      })
    );
    const rogueErr = rogueSock.messagesOfType('ERROR').slice(-1)[0];
    expect(rogueErr).toBeDefined();
    expect(rogueErr?.code).toBe('UNAUTHORIZED_PLAYER');
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(0);

    // Intento 2: socket autenticado del alumno intenta enviar otro playerId
    await harness.sendWsMessage(roomData.roomCode, studentSock, {
      type: 'ROLL_DICE',
      actionId: 'spoof_ws_10',
      playerId: 'plr_inventado_999',
      playerToken: studentJoin.playerToken,
    });
    const spoofErr = studentSock.messagesOfType('ERROR').slice(-1)[0];
    expect(spoofErr?.code).toBe('UNAUTHORIZED_PLAYER');

    // Intento 3: HTTP /action sin token válido
    const httpRes = await harness.httpFetch(`/api/rooms/${roomData.roomCode}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'forged_http_10',
        playerId: 'plr_inventado_999',
        playerToken: 'forged.token.signature',
      }),
    });
    expect(httpRes.status).toBe(401);
  });

  it('PRUEBA 11: Alumno B intenta usar playerToken de Alumno A -> servidor rechaza por discordancia de token/identidad', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);
    const { data: studentA } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Alumno A',
    });
    const { data: studentB } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Alumno B',
    });

    const teacherSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_t_11',
      playerId: roomData.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherToken: roomData.teacherToken,
      playerToken: roomData.playerToken,
    });
    const sockB = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_b_11',
      playerId: studentB.playerId,
      playerName: 'Alumno B',
      playerToken: studentB.playerToken,
    });

    await harness.sendWsMessage(roomData.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'start_11',
      teacherToken: roomData.teacherToken,
      command: { kind: 'START_GAME' },
    });

    // WS: Alumno B usa playerToken del Alumno A
    await harness.sendWsMessage(roomData.roomCode, sockB, {
      type: 'ROLL_DICE',
      actionId: 'steal_token_ws',
      playerId: studentB.playerId,
      playerToken: studentA.playerToken,
    });
    const wsErr = sockB.messagesOfType('ERROR').slice(-1)[0];
    expect(wsErr?.code).toBe('INVALID_PLAYER_TOKEN');

    // HTTP /action: Alumno B intenta actuar con su id + token del Alumno A
    const httpRes = await harness.httpFetch(`/api/rooms/${roomData.roomCode}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'steal_token_http',
        playerId: studentB.playerId,
        playerToken: studentA.playerToken,
      }),
    });
    expect(httpRes.status).toBe(401);
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(0);
  });

  it('PRUEBA 12: Hibernación de Durable Object conserva identidades registradas, adjuntos de WebSocket y permite tirar dado al despertar', async () => {
    const harness = createWorkerHarness();
    const { data: roomData } = await createRoomViaHttp(harness);
    const { data: studentJoin } = await joinRoomViaHttp(harness, roomData.roomCode, {
      playerName: 'Laura Hibernación',
    });

    const teacherSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_t_12',
      playerId: roomData.playerId,
      playerName: 'Prof. Prevención',
      isTeacher: true,
      teacherToken: roomData.teacherToken,
      playerToken: roomData.playerToken,
    });
    const studentSock = await harness.connectSocket(roomData.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'ws_s_12',
      playerId: studentJoin.playerId,
      playerName: 'Laura Hibernación',
      playerToken: studentJoin.playerToken,
    });

    await harness.sendWsMessage(roomData.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'start_12',
      teacherToken: roomData.teacherToken,
      command: { kind: 'START_GAME' },
    });

    // Simular hibernación completa del Durable Object y reactivación posterior
    const wokeRecord = harness.hibernateAndWakeDO(roomData.roomCode);

    // Alumno dispara ROLL_DICE directamente sobre el DO recién despertado tras hibernación
    await wokeRecord.instance.webSocketMessage(
      studentSock as unknown as WebSocket,
      JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'roll_after_wake_12',
        playerId: studentJoin.playerId,
        playerToken: studentJoin.playerToken,
      })
    );

    expect(studentSock.messagesOfType('ERROR')).toHaveLength(0);
    const rolled = studentSock.messagesOfType('DICE_ROLLED');
    expect(rolled).toHaveLength(1);
    const statsAfterWake = getRoomParticipantStats(rolled[0].state);
    expect(statsAfterWake.registeredCount).toBe(1);
    expect(statsAfterWake.connectedCount).toBe(1);
    expect(statsAfterWake.teacherConnected).toBe(true);
  });
});
