import { describe, expect, it, vi } from 'vitest';
import {
  GameRoomState,
  INITIAL_QUESTION_BANK,
  ServerToClientMessage,
  canPlayerActOnTeamTurn,
} from '@prl-oca/shared';
import workerEntry, { GameRoom } from '../apps/realtime/src/index';
import { useGameStore } from '../apps/web/src/stores/useGameStore';
import { mpClient } from '../apps/web/src/multiplayer/wsClient';

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

function createTurnHarness() {
  const namespaces = new Map<string, SimulatedDORecord>();

  const buildInstance = (ctx: SimulatedDORecord['ctx']) =>
    new GameRoom(ctx as never, {
      GAME_ROOMS: {} as DurableObjectNamespace,
      ENVIRONMENT: 'production',
      ALLOWED_ORIGIN: PROD_ALLOWED_ORIGIN,
      TEACHER_TOKEN_SECRET: 'turn-auth-secret',
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
          all: async () => ({ results: INITIAL_QUESTION_BANK }),
        }),
      } as unknown as D1Database,
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
    TEACHER_TOKEN_SECRET: 'turn-auth-secret',
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
    httpFetch: (path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has('Origin')) headers.set('Origin', PROD_ORIGIN);
      return workerEntry.fetch(new Request(`${WORKER_URL}${path}`, { ...init, headers }), env as never);
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
  };
}

async function setupRoom(params?: {
  studentCount?: number;
  mode?: 'teams' | 'individual';
  teamCount?: number;
  teacherParticipatesAsPlayer?: boolean;
}) {
  const harness = createTurnHarness();
  const teacherParticipatesAsPlayer = params?.teacherParticipatesAsPlayer ?? true;
  const studentCount = params?.studentCount ?? 2;
  const mode = params?.mode ?? 'teams';
  const teamCount = params?.teamCount ?? 3;

  const cRes = await harness.httpFetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherPin: 'PIN2026',
      teacherName: 'Prof. PRL',
      teacherParticipatesAsPlayer,
      config: {
        roomName: 'Turnos Autoritativos',
        mode,
        teamCount,
        maxPlayers: 15,
        diceMode: '1d6',
      },
    }),
  });
  const room = (await cRes.json()) as {
    roomCode: string;
    playerId: string;
    playerToken: string;
    teacherToken: string;
    state: GameRoomState;
  };

  const teacherSock = await harness.connectSocket(room.roomCode, {
    type: 'JOIN_ROOM',
    actionId: 'ws_t_init',
    playerId: room.playerId,
    playerName: 'Prof. PRL',
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
  }> = [];

  for (let i = 1; i <= studentCount; i++) {
    const jRes = await harness.httpFetch(`/api/rooms/${room.roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: `Alumno ${i}` }),
    });
    const jData = (await jRes.json()) as {
      playerId: string;
      playerToken: string;
    };
    const sock = await harness.connectSocket(room.roomCode, {
      type: 'JOIN_ROOM',
      actionId: `ws_s_${i}`,
      playerId: jData.playerId,
      playerName: `Alumno ${i}`,
      playerToken: jData.playerToken,
    });
    students.push({
      playerId: jData.playerId,
      playerToken: jData.playerToken,
      playerName: `Alumno ${i}`,
      sock,
    });
  }

  await harness.sendWs(room.roomCode, teacherSock, {
    type: 'TEACHER_ACTION',
    actionId: 'cmd_start',
    teacherToken: room.teacherToken,
    command: { kind: 'START_GAME' },
  });

  return { harness, room, teacherSock, students };
}

function getLatestState(sock: MockSocket): GameRoomState {
  for (let i = sock.inbox.length - 1; i >= 0; i--) {
    const m = sock.inbox[i];
    if ('state' in m && m.state) return m.state;
  }
  throw new Error('No state found on socket');
}

async function advancePastCurrentTurn(
  harness: ReturnType<typeof createTurnHarness>,
  roomCode: string,
  ownerSock: MockSocket,
  ownerId: string,
  ownerToken: string,
  teacherToken: string,
  teacherSock: MockSocket
) {
  const cur = getLatestState(ownerSock);
  if (cur.phase === 'waiting_roll') {
    await harness.sendWs(roomCode, ownerSock, {
      type: 'ROLL_DICE',
      actionId: `adv_roll_${Date.now()}_${Math.random()}`,
      playerId: ownerId,
      playerToken: ownerToken,
    });
  }
  const afterRoll = getLatestState(ownerSock);
  // Si cayó en Oca / casilla con extraRoll no queremos quedarnos en el mismo turno -> usar FORCE_NEXT_TURN explícito
  // o si abrió challenge resolverlo / avanzar al siguiente turno limpiamente
  if (afterRoll.activeChallenge && !afterRoll.activeChallenge.answered) {
    if (afterRoll.activeChallenge.kind === 'question' && afterRoll.activeChallenge.question) {
      await harness.sendWs(roomCode, ownerSock, {
        type: 'SUBMIT_ANSWER',
        actionId: `adv_ans_${Date.now()}`,
        playerId: ownerId,
        selectedIndices: [0],
        collaborated: true,
        playerToken: ownerToken,
      });
    } else if (
      afterRoll.activeChallenge.kind === 'challenge3d' &&
      afterRoll.activeChallenge.challenge3d
    ) {
      await harness.sendWs(roomCode, ownerSock, {
        type: 'COMPLETE_CHALLENGE_3D',
        actionId: `adv_ch_${Date.now()}`,
        playerId: ownerId,
        selectedHotspotIds: [afterRoll.activeChallenge.challenge3d.hotspots[0].id],
        playerToken: ownerToken,
      });
    }
  }
  const prevTeamIdx = afterRoll.activeTeamIndex;
  await harness.sendWs(roomCode, ownerSock, {
    type: 'NEXT_TURN',
    actionId: `adv_next_${Date.now()}`,
    playerId: ownerId,
    playerToken: ownerToken,
  });
  const afterNext = getLatestState(ownerSock);
  if (afterNext.activeTeamIndex === prevTeamIdx) {
    // Cayó en Oca con tirada extra: avanzar administrativamente para probar al siguiente participante
    await harness.sendWs(roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: `adv_force_${Date.now()}`,
      teacherToken,
      command: { kind: 'FORCE_NEXT_TURN' },
    });
  }
}

describe('Sistema Autoritativo de Turnos por PlayerId y Bloqueo Estricto (Pruebas 1-12)', () => {
  it('PRUEBA 1: Es el turno del profesor. El profesor lanza -> aceptado y mueve solo su ficha', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });

    const st0 = getLatestState(teacherSock);
    expect(st0.activePlayerId).toBe(room.playerId);
    const teacherTeamId = st0.players.find((p) => p.id === room.playerId)!.teamId;

    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'p1_teacher_roll',
      playerId: room.playerId,
      playerToken: room.playerToken,
    });

    expect(teacherSock.messagesOfType('ERROR')).toHaveLength(0);
    const rolled = teacherSock.messagesOfType('DICE_ROLLED').slice(-1)[0]!;
    expect(rolled.roll.rolledByPlayerId).toBe(room.playerId);
    expect(rolled.roll.rolledByTeamId).toBe(teacherTeamId);
    expect(students[0].sock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    const otherTeam = rolled.state.teams.find((t) => t.id !== teacherTeamId)!;
    expect(otherTeam.position).toBe(1);
  });

  it('PRUEBA 2: Es el turno del alumno 1. El profesor intenta lanzar -> NOT_YOUR_TURN y ninguna ficha se mueve', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });

    // Completar turno del profesor para pasar exactamente al Alumno 1
    await advancePastCurrentTurn(
      harness,
      room.roomCode,
      teacherSock,
      room.playerId,
      room.playerToken,
      room.teacherToken,
      teacherSock
    );

    const beforeAttempt = getLatestState(teacherSock);
    expect(beforeAttempt.activePlayerId).toBe(students[0].playerId);
    const prevPositions = beforeAttempt.teams.map((t) => t.position);

    // Profesor intenta lanzar en turno del Alumno 1 (por WS y por HTTP /action)
    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'p2_teacher_steal_ws',
      playerId: room.playerId,
      playerToken: room.playerToken,
    });

    const errWs = teacherSock.messagesOfType('ERROR').slice(-1)[0]!;
    expect(errWs.code).toBe('NOT_YOUR_TURN');

    const httpAttempt = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': room.playerToken,
        'X-Player-Id': room.playerId,
      },
      body: JSON.stringify({
        playerId: room.playerId,
        playerToken: room.playerToken,
        message: {
          type: 'ROLL_DICE',
          actionId: 'p2_teacher_steal_http',
          playerId: room.playerId,
          playerToken: room.playerToken,
        },
      }),
    });
    expect(httpAttempt.status).toBe(409);
    const httpJson = (await httpAttempt.json()) as { error: string; state: GameRoomState };
    expect(httpJson.error).toBe('NOT_YOUR_TURN');
    expect(httpJson.state.teams.map((t) => t.position)).toEqual(prevPositions);
    expect(httpJson.state.activePlayerId).toBe(students[0].playerId);
    expect(httpJson.state.phase).toBe('waiting_roll');
  });

  it('PRUEBA 3: Es el turno del alumno 1. El alumno 2 intenta lanzar -> NOT_YOUR_TURN y ninguna ficha se mueve', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 2,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: false,
    });

    const st = getLatestState(teacherSock);
    const activeId = st.activePlayerId!;
    const otherStu = students.find((s) => s.playerId !== activeId)!;
    const prevPositions = st.teams.map((t) => t.position);

    await harness.sendWs(room.roomCode, otherStu.sock, {
      type: 'ROLL_DICE',
      actionId: 'p3_stu2_roll',
      playerId: otherStu.playerId,
      playerToken: otherStu.playerToken,
    });

    const err = otherStu.sock.messagesOfType('ERROR').slice(-1)[0]!;
    expect(err.code).toBe('NOT_YOUR_TURN');
    expect(getLatestState(otherStu.sock).teams.map((t) => t.position)).toEqual(prevPositions);
    expect(getLatestState(otherStu.sock).phase).toBe('waiting_roll');
  });

  it('PRUEBA 4: Es el turno del alumno 1. El alumno 1 lanza -> aceptado y mueve exclusivamente su ficha', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 2,
      mode: 'individual',
      maxPlayers: 15,
      teacherParticipatesAsPlayer: false,
    } as never);

    const st0 = getLatestState(teacherSock);
    const activeId = st0.activePlayerId!;
    const activeStu = students.find((s) => s.playerId === activeId)!;
    const activeTeamId = st0.players.find((p) => p.id === activeId)!.teamId;

    await harness.sendWs(room.roomCode, activeStu.sock, {
      type: 'ROLL_DICE',
      actionId: 'p4_stu1_roll',
      playerId: activeStu.playerId,
      playerToken: activeStu.playerToken,
    });

    expect(activeStu.sock.messagesOfType('ERROR')).toHaveLength(0);
    const rolled = activeStu.sock.messagesOfType('DICE_ROLLED').slice(-1)[0]!;
    expect(rolled.roll.rolledByPlayerId).toBe(activeStu.playerId);
    expect(rolled.roll.rolledByTeamId).toBe(activeTeamId);
    for (const t of rolled.state.teams) {
      if (t.id !== activeTeamId) expect(t.position).toBe(1);
    }
  });

  it('PRUEBA 5: El profesor intenta lanzar dos veces seguidas -> rechazado (sin turno / fase ya lanzada) sin mover otra ficha', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });

    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'p5_teacher_roll_1',
      playerId: room.playerId,
      playerToken: room.playerToken,
    });
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    const afterFirstPos = getLatestState(teacherSock).teams.map((t) => t.position);

    // Intento inmediato de segundo lanzamiento consecutivo en mismo turno
    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'p5_teacher_roll_2_immediate',
      playerId: room.playerId,
      playerToken: room.playerToken,
    });
    const errImmediate = teacherSock.messagesOfType('ERROR').slice(-1)[0]!;
    expect(errImmediate.code).toBe('INVALID_PHASE');
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    expect(getLatestState(teacherSock).teams.map((t) => t.position)).toEqual(afterFirstPos);

    // Tras pasar turno al Alumno 1, profesor intenta lanzar otra vez -> NOT_YOUR_TURN
    await advancePastCurrentTurn(
      harness,
      room.roomCode,
      teacherSock,
      room.playerId,
      room.playerToken,
      room.teacherToken,
      teacherSock
    );
    expect(getLatestState(teacherSock).activePlayerId).toBe(students[0].playerId);

    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'p5_teacher_roll_3_after_turn',
      playerId: room.playerId,
      playerToken: room.playerToken,
    });
    expect(teacherSock.messagesOfType('ERROR').slice(-1)[0]!.code).toBe('NOT_YOUR_TURN');
  });

  it('PRUEBA 6: Dos participantes intentan lanzar simultáneamente -> solo se acepta el del turno autoritativo', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });

    expect(getLatestState(teacherSock).activePlayerId).toBe(room.playerId);

    // Disparo concurrente vía Promise.all sobre la misma sala
    const [resTeacher, resStudent] = await Promise.all([
      harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Player-Token': room.playerToken,
        },
        body: JSON.stringify({
          type: 'ROLL_DICE',
          actionId: 'p6_concurrent_t',
          playerId: room.playerId,
          playerToken: room.playerToken,
        }),
      }),
      harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Player-Token': students[0].playerToken,
        },
        body: JSON.stringify({
          type: 'ROLL_DICE',
          actionId: 'p6_concurrent_s',
          playerId: students[0].playerId,
          playerToken: students[0].playerToken,
        }),
      }),
    ]);

    expect(resTeacher.status).toBe(200);
    expect(resStudent.status).toBe(409);
    expect(((await resStudent.json()) as { error: string }).error).toBe('NOT_YOUR_TURN');
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    expect(students[0].sock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    expect(students[0].sock.messagesOfType('DICE_ROLLED')[0].roll.rolledByPlayerId).toBe(
      room.playerId
    );
  });

  it('PRUEBA 7: Un jugador envía el playerId de otro participante -> petición rechazada sin ejecutar acción', async () => {
    const { harness, room, students } = await setupRoom({
      studentCount: 2,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: false,
    });

    const st = getLatestState(students[0].sock);
    const activeStu = students.find((s) => s.playerId === st.activePlayerId)!;
    const otherStu = students.find((s) => s.playerId !== st.activePlayerId)!;

    // Por WS: socket de otherStu intenta enviar playerId de activeStu
    await harness.sendWs(room.roomCode, otherStu.sock, {
      type: 'ROLL_DICE',
      actionId: 'p7_spoof_ws',
      playerId: activeStu.playerId,
      playerToken: otherStu.playerToken,
    });
    expect(otherStu.sock.messagesOfType('ERROR').slice(-1)[0]!.code).toBe('UNAUTHORIZED_PLAYER');

    // Por HTTP: token/header de otherStu intentando actuar con playerId de activeStu
    const spoofHttp = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': otherStu.playerToken,
        'X-Player-Id': otherStu.playerId,
      },
      body: JSON.stringify({
        playerId: activeStu.playerId,
        playerToken: otherStu.playerToken,
        message: {
          type: 'ROLL_DICE',
          actionId: 'p7_spoof_http',
          playerId: activeStu.playerId,
          playerToken: otherStu.playerToken,
        },
      }),
    });
    expect([401, 403]).toContain(spoofHttp.status);
    expect(activeStu.sock.messagesOfType('DICE_ROLLED')).toHaveLength(0);
  });

  it('PRUEBA 8: Un jugador intenta lanzar durante una pausa -> acción rechazada y tablero intacto', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });

    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'p8_pause',
      teacherToken: room.teacherToken,
      command: { kind: 'PAUSE_GAME' },
    });

    expect(getLatestState(teacherSock).status).toBe('paused');

    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'p8_roll_paused',
      playerId: room.playerId,
      playerToken: room.playerToken,
    });

    const err = teacherSock.messagesOfType('ERROR').slice(-1)[0]!;
    expect(err.code).toBe('ROOM_NOT_PLAYING');
    expect(err.message).toContain('pausada');
    expect(students[0].sock.messagesOfType('DICE_ROLLED')).toHaveLength(0);
  });

  it('PRUEBA 9: El turno pasa de un alumno a otro -> ambos clientes reciben el mismo jugador activo y se actualiza Zustand', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 2,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: false,
    });

    const stInitial = getLatestState(students[0].sock);
    const firstStu = students.find((s) => s.playerId === stInitial.activePlayerId)!;
    const secondStu = students.find((s) => s.playerId !== stInitial.activePlayerId)!;

    await advancePastCurrentTurn(
      harness,
      room.roomCode,
      firstStu.sock,
      firstStu.playerId,
      firstStu.playerToken,
      room.teacherToken,
      teacherSock
    );

    const stateOnStu1 = getLatestState(firstStu.sock);
    const stateOnStu2 = getLatestState(secondStu.sock);
    const stateOnTeacher = getLatestState(teacherSock);

    expect(stateOnStu1.activePlayerId).toBe(secondStu.playerId);
    expect(stateOnStu2.activePlayerId).toBe(secondStu.playerId);
    expect(stateOnTeacher.activePlayerId).toBe(secondStu.playerId);

    // También comprobar validación inmediata en useGameStore para quien no tiene turno
    useGameStore.setState({
      screen: 'game',
      playerId: firstStu.playerId,
      isTeacher: false,
      roomState: structuredClone(stateOnStu1),
      isRollingAnimation: false,
      errorMessage: null,
    });
    expect(canPlayerActOnTeamTurn(stateOnStu1, firstStu.playerId).allowed).toBe(false);
    expect(canPlayerActOnTeamTurn(stateOnStu1, secondStu.playerId).allowed).toBe(true);
  });

  it('PRUEBA 10: Quince participantes conectados -> únicamente el jugador dueño del activePlayerId puede lanzar', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 15,
      mode: 'teams',
      teamCount: 3,
      teacherParticipatesAsPlayer: false,
    });

    expect(students).toHaveLength(15);
    const st = getLatestState(teacherSock);
    const activePlayerId = st.activePlayerId!;
    const authorizedStu = students.find((s) => s.playerId === activePlayerId)!;
    const unauthorizedOthers = students.filter((s) => s.playerId !== activePlayerId);

    // Ni los otros 14 alumnos (incluidos compañeros del MISMO equipo) ni el profesor pueden lanzar
    for (const s of unauthorizedOthers) {
      await harness.sendWs(room.roomCode, s.sock, {
        type: 'ROLL_DICE',
        actionId: `p10_denied_${s.playerId}`,
        playerId: s.playerId,
        playerToken: s.playerToken,
      });
      expect(s.sock.messagesOfType('ERROR').slice(-1)[0]!.code).toBe('NOT_YOUR_TURN');
    }
    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'ROLL_DICE',
      actionId: 'p10_denied_teacher',
      playerId: room.playerId,
      playerToken: room.playerToken,
    });
    expect(teacherSock.messagesOfType('ERROR').slice(-1)[0]!.code).toBe('NOT_YOUR_TURN');
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(0);

    // Ahora el único participante dueño del turno lanza con éxito
    await harness.sendWs(room.roomCode, authorizedStu.sock, {
      type: 'ROLL_DICE',
      actionId: 'p10_allowed_active',
      playerId: authorizedStu.playerId,
      playerToken: authorizedStu.playerToken,
    });
    expect(authorizedStu.sock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    expect(authorizedStu.sock.messagesOfType('DICE_ROLLED')[0].roll.rolledByPlayerId).toBe(
      authorizedStu.playerId
    );
  });

  it('PRUEBA 11: Reconexión durante un turno -> se conserva el activePlayerId exacto y permite completar la tirada', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 2,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: false,
    });

    const stBefore = getLatestState(teacherSock);
    const turnOwner = students.find((s) => s.playerId === stBefore.activePlayerId)!;
    const otherStu = students.find((s) => s.playerId !== stBefore.activePlayerId)!;

    // TurnOwner se desconecta mientras es SU turno
    await harness.closeSocket(room.roomCode, turnOwner.sock);
    const stWhileDisconnected = getLatestState(teacherSock);
    expect(stWhileDisconnected.activePlayerId).toBe(turnOwner.playerId);

    // El otro alumno NO puede robarle el turno mientras está desconectado
    await harness.sendWs(room.roomCode, otherStu.sock, {
      type: 'ROLL_DICE',
      actionId: 'p11_steal_disconnected',
      playerId: otherStu.playerId,
      playerToken: otherStu.playerToken,
    });
    expect(otherStu.sock.messagesOfType('ERROR').slice(-1)[0]!.code).toBe('NOT_YOUR_TURN');

    // TurnOwner vuelve a conectarse y conserva su turno exacto
    const reconnectedSock = await harness.connectSocket(room.roomCode, {
      type: 'JOIN_ROOM',
      actionId: 'p11_reconnect',
      playerId: turnOwner.playerId,
      playerName: turnOwner.playerName,
      playerToken: turnOwner.playerToken,
    });
    expect(getLatestState(reconnectedSock).activePlayerId).toBe(turnOwner.playerId);

    await harness.sendWs(room.roomCode, reconnectedSock, {
      type: 'ROLL_DICE',
      actionId: 'p11_roll_after_reconnect',
      playerId: turnOwner.playerId,
      playerToken: turnOwner.playerToken,
    });
    expect(reconnectedSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
  });

  it('PRUEBA 12: Dos peticiones ROLL_DICE simultáneas con el mismo actionId -> un único lanzamiento', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });

    const sameActionPayload = {
      type: 'ROLL_DICE' as const,
      actionId: 'p12_same_action_999',
      playerId: room.playerId,
      playerToken: room.playerToken,
    };

    // Disparo simultáneo por WebSocket + HTTP con idéntico actionId
    const [httpRes1, httpRes2] = await Promise.all([
      harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
        body: JSON.stringify(sameActionPayload),
      }),
      harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
        body: JSON.stringify(sameActionPayload),
      }),
    ]);

    expect(httpRes1.status).toBe(200);
    expect(httpRes2.status).toBe(200);
    const j1 = (await httpRes1.json()) as {
      deduplicated?: boolean;
      event: Extract<ServerToClientMessage, { type: 'DICE_ROLLED' }>;
    };
    const j2 = (await httpRes2.json()) as {
      deduplicated?: boolean;
      event: Extract<ServerToClientMessage, { type: 'DICE_ROLLED' }>;
    };
    expect([j1.deduplicated, j2.deduplicated].sort()).toEqual([false, true]);
    expect(j1.event.roll.total).toBe(j2.event.roll.total);
    // Solo se difundió UN evento DICE_ROLLED a los sockets conectados
    expect(teacherSock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
    expect(students[0].sock.messagesOfType('DICE_ROLLED')).toHaveLength(1);

    // Reenvío WS simultáneo posterior con el mismo actionId tampoco lanza otra vez
    await Promise.all([
      harness.sendWs(room.roomCode, teacherSock, sameActionPayload),
      harness.sendWs(room.roomCode, teacherSock, sameActionPayload),
    ]);
    expect(students[0].sock.messagesOfType('DICE_ROLLED')).toHaveLength(1);
  });

  it('PRUEBA 13: Casillas especiales encadenadas (Oca 5->11 y 17->23) en el mismo turnNumber no bloquean Continuar Recorrido ni reutilizan actionId', async () => {
    const { harness, room, teacherSock } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });

    const sentActionIds: string[] = [];
    const sendSpy = vi.spyOn(mpClient, 'send').mockImplementation((msg) => {
      if ('actionId' in msg) sentActionIds.push(msg.actionId);
      void harness.sendWs(room.roomCode, teacherSock, msg).then(() => {
        const latestMsg = teacherSock.inbox[teacherSock.inbox.length - 1];
        if (latestMsg) {
          useGameStore.getState().applyServerMessage(latestMsg);
        }
      });
      return true;
    });
    const isConnSpy = vi.spyOn(mpClient, 'isConnected').mockReturnValue(true);

    try {
      // Oca #1 en turnNumber=1: sacar 4 desde casilla 1 -> casilla 5 -> redirige a 11 (showing_feedback, extraRoll=true)
      const dieSpy = vi
        .spyOn(globalThis.crypto, 'getRandomValues')
        .mockImplementationOnce((arr) => {
          (arr as Uint32Array)[0] = 3; // (3 % 6) + 1 = 4 -> tile 1 + 4 = 5 (Oca -> 11)
          return arr;
        });

      const r1 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
        body: JSON.stringify({
          type: 'ROLL_DICE',
          actionId: 'p13_roll_oca_1',
          playerId: room.playerId,
          playerToken: room.playerToken,
        }),
      });
      expect(r1.status).toBe(200);
      const j1 = (await r1.json()) as { state: GameRoomState };
      expect(j1.state.phase).toBe('showing_feedback');
      expect(j1.state.teams[0].position).toBe(11);

      useGameStore.setState({
        screen: 'game',
        isRemoteSession: true,
        connectionStatus: 'connected',
        playerId: room.playerId,
        playerToken: room.playerToken,
        isTeacher: true,
        isSpectator: false,
        roomState: structuredClone(j1.state),
        isRollingAnimation: false,
        isTokenMoving: false,
        challengeModalReady: true,
        errorMessage: null,
      });

      // 1a pulsación de "Continuar Recorrido" en turnNumber=1 -> phase vuelve a waiting_roll y turnNumber sigue siendo 1
      useGameStore.getState().nextTurn();
      await vi.waitFor(() => {
        expect(useGameStore.getState().roomState?.phase).toBe('waiting_roll');
      });
      expect(useGameStore.getState().roomState?.turnNumber).toBe(1);
      expect(sentActionIds).toHaveLength(1);

      // Oca #2 en el MISMO turnNumber=1: sacar 6 desde casilla 11 -> 17 -> redirige a 23 (mismo caso que la captura del usuario)
      dieSpy.mockImplementationOnce((arr) => {
        (arr as Uint32Array)[0] = 5; // (5 % 6) + 1 = 6 -> tile 11 + 6 = 17 (Oca -> 23)
        return arr;
      });
      const r2 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
        body: JSON.stringify({
          type: 'ROLL_DICE',
          actionId: 'p13_roll_oca_2',
          playerId: room.playerId,
          playerToken: room.playerToken,
        }),
      });
      expect(r2.status).toBe(200);
      const j2 = (await r2.json()) as { state: GameRoomState };
      expect(j2.state.phase).toBe('showing_feedback');
      expect(j2.state.teams[0].position).toBe(23);
      expect(j2.state.turnNumber).toBe(1);
      useGameStore.setState({ roomState: structuredClone(j2.state) });

      // 2a pulsación de "Continuar Recorrido" en el mismo turnNumber=1
      useGameStore.getState().nextTurn();
      await vi.waitFor(() => {
        expect(useGameStore.getState().roomState?.phase).toBe('waiting_roll');
      });
      expect(useGameStore.getState().roomState?.teams[0].position).toBe(23);
      expect(sentActionIds).toHaveLength(2);
      // Crítico: el segundo NEXT_TURN NUNCA puede reutilizar el actionId del primero
      expect(sentActionIds[1]).not.toBe(sentActionIds[0]);

      // 3. Enviar NEXT_TURN cuando phase ya es waiting_roll debe devolver 409 INVALID_PHASE sin saltar turno
      const invalidNext = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
        body: JSON.stringify({
          type: 'NEXT_TURN',
          actionId: 'p13_invalid_phase_next',
          playerId: room.playerId,
          playerToken: room.playerToken,
        }),
      });
      expect(invalidNext.status).toBe(409);
      const invalidJson = (await invalidNext.json()) as { error: string; state?: GameRoomState };
      expect(invalidJson.error).toBe('INVALID_PHASE');
      expect(invalidJson.state?.activePlayerId).toBe(room.playerId);
      dieSpy.mockRestore();
    } finally {
      sendSpy.mockRestore();
      isConnSpy.mockRestore();
    }
  });

  it('PRUEBA 14: WebSocket colgado al pulsar Continuar Recorrido activa respaldo HTTP automático sin quedarse bloqueado', async () => {
    vi.useFakeTimers();
    const { harness, room } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });

    const dieSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementationOnce((arr) => {
      (arr as Uint32Array)[0] = 3; // tile 1 + 4 = 5 (Oca -> 11)
      return arr;
    });
    const rollRes = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
      body: JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'p14_roll_oca',
        playerId: room.playerId,
        playerToken: room.playerToken,
      }),
    });
    dieSpy.mockRestore();
    const rolledJson = (await rollRes.json()) as { state: GameRoomState };
    expect(rolledJson.state.phase).toBe('showing_feedback');
    expect(rolledJson.state.teams[0].position).toBe(11);

    // Simula WS aparentemente conectado pero que descarta silenciosamente el frame (socket zombi)
    const sendSpy = vi.spyOn(mpClient, 'send').mockReturnValue(true);
    const isConnSpy = vi.spyOn(mpClient, 'isConnected').mockReturnValue(true);
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      const pathname = new URL(urlStr).pathname;
      return harness.httpFetch(pathname, init);
    });
    vi.stubGlobal('fetch', fetchSpy);

    try {
      useGameStore.setState({
        screen: 'game',
        isRemoteSession: true,
        connectionStatus: 'connected',
        playerId: room.playerId,
        playerToken: room.playerToken,
        isTeacher: true,
        isSpectator: false,
        roomState: structuredClone(rolledJson.state),
        isRollingAnimation: false,
        isTokenMoving: false,
        challengeModalReady: true,
        errorMessage: null,
      });

      useGameStore.getState().nextTurn();
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Tras 1800ms sin respuesta WS, debe disparar /action por HTTP y avanzar la fase a waiting_roll
      await vi.advanceTimersByTimeAsync(1900);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(useGameStore.getState().roomState?.phase).toBe('waiting_roll');
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      sendSpy.mockRestore();
      isConnSpy.mockRestore();
    }
  });

  it('PRUEBA 15: Partida continúa hasta que todos los participantes alcanzan la Meta (#48), omite turnos de finalistas y celebra cada llegada', async () => {
    const { harness, room, teacherSock, students } = await setupRoom({
      studentCount: 1,
      mode: 'teams',
      teamCount: 2,
      teacherParticipatesAsPlayer: true,
    });
    const stu = students[0];

    // Mover ambos equipos cerca de la meta (#47)
    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'p15_move_t1',
      teacherToken: room.teacherToken,
      command: { kind: 'MOVE_TEAM', teamId: 'team_1', targetTile: 47 },
    });
    await harness.sendWs(room.roomCode, teacherSock, {
      type: 'TEACHER_ACTION',
      actionId: 'p15_move_t2',
      teacherToken: room.teacherToken,
      command: { kind: 'MOVE_TEAM', teamId: 'team_2', targetTile: 47 },
    });

    // 1. Profesor (team_1) saca 1 -> llega a Casilla #48 y acierta pregunta final
    const dieSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr) => {
      (arr as Uint32Array)[0] = 0; // (0 % 6) + 1 = 1 -> 47 + 1 = 48
      return arr;
    });
    try {
      const r1 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
        body: JSON.stringify({
          type: 'ROLL_DICE',
          actionId: 'p15_t1_roll48',
          playerId: room.playerId,
          playerToken: room.playerToken,
        }),
      });
      expect(r1.status).toBe(200);
      const j1 = (await r1.json()) as { state: GameRoomState };
      expect(j1.state.teams[0].position).toBe(48);
      const q1 = j1.state.activeChallenge!.question!;
      expect(q1.correctIndices).toEqual([]);
      expect(q1.correctOptionIds).toBeUndefined();
      const origQ1 = INITIAL_QUESTION_BANK.find((q) => q.id === q1.id)!;
      const expectedCorrectIds1 = origQ1.correctIndices.map((idx) => `${origQ1.id}_opt_${idx}`);

      const a1 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
        body: JSON.stringify({
          type: 'SUBMIT_ANSWER',
          actionId: 'p15_t1_ans48',
          playerId: room.playerId,
          selectedOptionIds: expectedCorrectIds1,
          collaborated: true,
          playerToken: room.playerToken,
        }),
      });
      expect(a1.status).toBe(200);
      const ansJson1 = (await a1.json()) as { state: GameRoomState };
      expect(ansJson1.state.activeChallenge!.question!.correctIndices.length).toBeGreaterThan(0);
      // Crítico: team_1 llegó en #1, pero Alumno 1 aún no ha llegado -> partida sigue PLAYING
      expect(ansJson1.state.status).toBe('playing');
      expect(ansJson1.state.phase).toBe('showing_feedback');
      expect(ansJson1.state.teams[0].finishOrder).toBe(1);
      expect(ansJson1.state.finishedTeamIds).toEqual(['team_1']);
      expect(ansJson1.state.lastGoalCelebration?.finishOrder).toBe(1);
      expect(ansJson1.state.lastGoalCelebration?.allFinished).toBe(false);

      // Avanzar turno -> pasa a Alumno 1 (team_2)
      const n1 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': room.playerToken },
        body: JSON.stringify({
          type: 'NEXT_TURN',
          actionId: 'p15_t1_next',
          playerId: room.playerId,
          playerToken: room.playerToken,
        }),
      });
      expect(n1.status).toBe(200);
      const nextJson1 = (await n1.json()) as { state: GameRoomState };
      expect(nextJson1.state.activePlayerId).toBe(stu.playerId);

      // 2. Alumno 1 (team_2) saca 1 -> llega a Casilla #48, FALLA una vez -> retrocede a #46 y el turno omite a team_1 (ya finalista)
      const r2 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': stu.playerToken },
        body: JSON.stringify({
          type: 'ROLL_DICE',
          actionId: 'p15_s1_roll48_fail',
          playerId: stu.playerId,
          playerToken: stu.playerToken,
        }),
      });
      expect(r2.status).toBe(200);
      const q2 = ((await r2.json()) as { state: GameRoomState }).state.activeChallenge!.question!;
      const origQ2 = INITIAL_QUESTION_BANK.find((q) => q.id === q2.id)!;
      const expectedCorrectIds2 = origQ2.correctIndices.map((idx) => `${origQ2.id}_opt_${idx}`);
      const wrongOptId2 = (q2.optionIds ?? []).find((id) => !expectedCorrectIds2.includes(id));
      const wrongSelection = wrongOptId2 ? [wrongOptId2] : ['__TIMEOUT__'];
      const a2Wrong = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': stu.playerToken },
        body: JSON.stringify({
          type: 'SUBMIT_ANSWER',
          actionId: 'p15_s1_wrong48',
          playerId: stu.playerId,
          selectedOptionIds: wrongSelection,
          collaborated: false,
          playerToken: stu.playerToken,
        }),
      });
      expect(a2Wrong.status).toBe(200);
      const wrongState = ((await a2Wrong.json()) as { state: GameRoomState }).state;
      expect(wrongState.teams[1].position).toBe(46);
      expect(wrongState.status).toBe('playing');

      const n2 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': stu.playerToken },
        body: JSON.stringify({
          type: 'NEXT_TURN',
          actionId: 'p15_s1_next_after_fail',
          playerId: stu.playerId,
          playerToken: stu.playerToken,
        }),
      });
      expect(n2.status).toBe(200);
      const skipFinishedState = ((await n2.json()) as { state: GameRoomState }).state;
      // Crítico: team_1 ya terminó (#48), el turno vuelve directamente a Alumno 1
      expect(skipFinishedState.activePlayerId).toBe(stu.playerId);

      // 3. Alumno 1 avanza 2 (46 -> 48) y acierta -> AHORA SÍ termina para todos (finished, allFinished=true)
      dieSpy.mockImplementation((arr) => {
        (arr as Uint32Array)[0] = 1; // (1 % 6) + 1 = 2 -> 46 + 2 = 48
        return arr;
      });
      const r3 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': stu.playerToken },
        body: JSON.stringify({
          type: 'ROLL_DICE',
          actionId: 'p15_s1_roll48_win',
          playerId: stu.playerId,
          playerToken: stu.playerToken,
        }),
      });
      expect(r3.status).toBe(200);
      const q3 = ((await r3.json()) as { state: GameRoomState }).state.activeChallenge!.question!;
      const origQ3 = INITIAL_QUESTION_BANK.find((q) => q.id === q3.id)!;
      const expectedCorrectIds3 = origQ3.correctIndices.map((idx) => `${origQ3.id}_opt_${idx}`);
      const a3 = await harness.httpFetch(`/api/rooms/${room.roomCode}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Player-Token': stu.playerToken },
        body: JSON.stringify({
          type: 'SUBMIT_ANSWER',
          actionId: 'p15_s1_ans48_win',
          playerId: stu.playerId,
          selectedOptionIds: expectedCorrectIds3,
          collaborated: false,
          playerToken: stu.playerToken,
        }),
      });
      expect(a3.status).toBe(200);
      const finalState = ((await a3.json()) as { state: GameRoomState }).state;
      expect(finalState.status).toBe('finished');
      expect(finalState.phase).toBe('finished');
      expect(finalState.finishedTeamIds).toEqual(['team_1', 'team_2']);
      expect(finalState.teams[0].finishOrder).toBe(1);
      expect(finalState.teams[1].finishOrder).toBe(2);
      expect(finalState.lastGoalCelebration?.finishOrder).toBe(2);
      expect(finalState.lastGoalCelebration?.allFinished).toBe(true);
    } finally {
      dieSpy.mockRestore();
    }
  });
});
