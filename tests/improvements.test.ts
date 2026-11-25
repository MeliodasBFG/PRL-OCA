import { describe, expect, it, vi } from 'vitest';
import {
  GameRoomState,
  INITIAL_QUESTION_BANK,
  QuestionItem,
  ServerToClientMessage,
  createInitialRoomState,
  executeTeacherCommandServerSide,
  joinPlayerToState,
  rollDiceServerSide,
  sanitizeStateForClient,
  shuffleQuestionOptions,
  submitAnswerServerSide,
} from '@prl-oca/shared';
import workerEntry, { GameRoom } from '../apps/realtime/src/index';
import { useGameStore } from '../apps/web/src/stores/useGameStore';
import { mpClient } from '../apps/web/src/multiplayer/wsClient';

const PROD_ORIGIN = 'https://prl-oca.pages.dev';
const WORKER_URL = 'https://realtime.danielcalvinoouro.workers.dev';
const PROD_ALLOWED_ORIGIN =
  'https://prl-oca.pages.dev,https://*.prl-oca.pages.dev';

class TestSocket {
  public inbox: ServerToClientMessage[] = [];
  public closedCode?: number;
  public closedReason?: string;
  public closed = false;
  private attachment: unknown = undefined;

  public send(payload: string): void {
    if (this.closed) return;
    this.inbox.push(JSON.parse(payload) as ServerToClientMessage);
  }

  public close(code?: number, reason?: string): void {
    this.closed = true;
    this.closedCode = code;
    this.closedReason = reason;
  }

  public serializeAttachment(att: unknown): void {
    this.attachment = att;
  }

  public deserializeAttachment(): unknown {
    return this.attachment;
  }

  public latestState(): GameRoomState {
    for (let i = this.inbox.length - 1; i >= 0; i--) {
      const m = this.inbox[i];
      if ('state' in m && m.state) return m.state;
    }
    throw new Error('No state message received on socket');
  }

  public errors(): Array<Extract<ServerToClientMessage, { type: 'ERROR' }>> {
    return this.inbox.filter((m) => m.type === 'ERROR') as Array<
      Extract<ServerToClientMessage, { type: 'ERROR' }>
    >;
  }
}

interface SimDO {
  storageMap: Map<string, unknown>;
  sockets: TestSocket[];
  instance: GameRoom;
}

function createRoomHarness() {
  const rooms = new Map<string, SimDO>();

  const getOrCreate = (roomCode: string): SimDO => {
    const key = roomCode.toUpperCase();
    const existing = rooms.get(key);
    if (existing) return existing;

    const storageMap = new Map<string, unknown>();
    const sockets: TestSocket[] = [];
    const ctx = {
      storage: {
        get: async <T>(k: string) => storageMap.get(k) as T | undefined,
        put: async (k: string, v: unknown) => {
          storageMap.set(k, v);
        },
      },
      getWebSockets: () => sockets.filter((s) => !s.closed) as unknown as WebSocket[],
    };

    const instance = new GameRoom(ctx as never, {
      GAME_ROOMS: {} as DurableObjectNamespace,
      ENVIRONMENT: 'production',
      ALLOWED_ORIGIN: PROD_ALLOWED_ORIGIN,
      TEACHER_TOKEN_SECRET: 'improvements-secret-key',
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

    const created = { storageMap, sockets, instance };
    rooms.set(key, created);
    return created;
  };

  const env = {
    ENVIRONMENT: 'production',
    ALLOWED_ORIGIN: PROD_ALLOWED_ORIGIN,
    TEACHER_TOKEN_SECRET: 'improvements-secret-key',
    GAME_ROOMS: {
      idFromName: (name: string) => name as unknown as DurableObjectId,
      get: (id: DurableObjectId) => ({
        fetch: (req: Request) => getOrCreate(String(id)).instance.fetch(req),
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
      return workerEntry.fetch(
        new Request(`${WORKER_URL}${path}`, { ...init, headers }),
        env as never
      );
    },
    connectSocket: async (roomCode: string, joinMsg: Record<string, unknown>) => {
      const rec = getOrCreate(roomCode);
      const sock = new TestSocket();
      rec.sockets.push(sock);
      await rec.instance.webSocketMessage(sock as unknown as WebSocket, JSON.stringify(joinMsg));
      return sock;
    },
    closeSocket: async (roomCode: string, sock: TestSocket) => {
      const rec = getOrCreate(roomCode);
      sock.close(1000, 'CLIENT_CLOSED');
      await rec.instance.webSocketClose(sock as unknown as WebSocket);
    },
    sendWs: async (roomCode: string, sock: TestSocket, msg: Record<string, unknown>) => {
      const rec = getOrCreate(roomCode);
      await rec.instance.webSocketMessage(sock as unknown as WebSocket, JSON.stringify(msg));
    },
  };
}

async function createMultiplayerFixture(options?: {
  studentCount?: number;
  mode?: 'teams' | 'individual';
  teamCount?: number;
  maxPlayers?: number;
  teacherParticipatesAsPlayer?: boolean;
}) {
  const harness = createRoomHarness();
  const studentCount = options?.studentCount ?? 2;
  const teacherParticipatesAsPlayer = options?.teacherParticipatesAsPlayer ?? true;

  const createRes = await harness.httpFetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherPin: 'DOCENTE2026',
      teacherName: 'Profesora Elena',
      teacherParticipatesAsPlayer,
      config: {
        mode: options?.mode ?? 'individual',
        teamCount: options?.teamCount ?? 3,
        maxPlayers: options?.maxPlayers ?? 15,
        diceMode: '1d6',
      },
    }),
  });
  expect(createRes.status).toBe(200);
  const created = (await createRes.json()) as {
    roomCode: string;
    playerId: string;
    playerToken: string;
    teacherToken: string;
    state: GameRoomState;
  };

  const teacherSock = await harness.connectSocket(created.roomCode, {
    type: 'JOIN_ROOM',
    actionId: `join_teacher_${Date.now()}`,
    playerId: created.playerId,
    playerName: 'Profesora Elena',
    isTeacher: true,
    participatesAsPlayer: teacherParticipatesAsPlayer,
    teacherToken: created.teacherToken,
    playerToken: created.playerToken,
  });

  const students: Array<{
    playerId: string;
    playerName: string;
    playerToken: string;
    sock: TestSocket;
  }> = [];

  for (let i = 1; i <= studentCount; i++) {
    const playerName = `Alumno ${i}`;
    const joinRes = await harness.httpFetch(`/api/rooms/${created.roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName }),
    });
    expect(joinRes.status).toBe(200);
    const joined = (await joinRes.json()) as {
      playerId: string;
      playerToken: string;
    };
    const sock = await harness.connectSocket(created.roomCode, {
      type: 'JOIN_ROOM',
      actionId: `join_stu_${i}_${Date.now()}`,
      playerId: joined.playerId,
      playerName,
      playerToken: joined.playerToken,
    });
    students.push({
      playerId: joined.playerId,
      playerName,
      playerToken: joined.playerToken,
      sock,
    });
  }

  return { harness, created, teacherSock, students };
}

describe('Mejoras PRL-OCA 3D: Aleatorización, Expulsión y Saltar Turno', () => {
  describe('1. Aleatorización Fisher-Yates de respuestas e IDs estables', () => {
    it('distribuye la respuesta correcta por todas las posiciones (incluida la última) sin mutar el banco original', () => {
      const source = INITIAL_QUESTION_BANK.find(
        (q) => q.type === 'test' && q.options.length === 4
      )!;
      const originalOptionsSnapshot = [...source.options];
      const originalCorrectSnapshot = [...source.correctIndices];

      const positionCounts = new Array<number>(4).fill(0);
      for (let i = 0; i < 200; i++) {
        const presented = shuffleQuestionOptions(source);
        expect(presented.options).toHaveLength(4);
        expect(presented.optionIds).toHaveLength(4);
        expect(presented.correctIndices).toHaveLength(1);
        expect(presented.correctOptionIds).toEqual([
          `${source.id}_opt_${source.correctIndices[0]}`,
        ]);
        const pos = presented.correctIndices[0];
        positionCounts[pos]++;
        expect(presented.options[pos]).toBe(source.options[source.correctIndices[0]]);
        expect(presented.optionIds![pos]).toBe(presented.correctOptionIds![0]);
      }

      // Todas las posiciones 0..3 (incluida la última posición 3) deben haber aparecido múltiples veces
      expect(positionCounts[0]).toBeGreaterThan(15);
      expect(positionCounts[1]).toBeGreaterThan(15);
      expect(positionCounts[2]).toBeGreaterThan(15);
      expect(positionCounts[3]).toBeGreaterThan(15);

      // El banco origen permanece completamente inmutable
      expect(source.options).toEqual(originalOptionsSnapshot);
      expect(source.correctIndices).toEqual(originalCorrectSnapshot);
    });

    it('mantiene ancladas opciones literalmente dependientes del orden ("Todas las anteriores") y baraja las demás', () => {
      const customQ: QuestionItem = {
        id: 'q_custom_dep',
        title: 'Equipos de trabajo seguros',
        prompt: '¿Qué medidas preventivas aplican antes de poner en marcha la máquina?',
        category: 'riesgos_mecanicos',
        difficulty: 'intermedio',
        type: 'test',
        options: [
          'Comprobar resguardos fijos',
          'Verificar seta de emergencia',
          'Revisar ausencia de herramientas sueltas',
          'Todas las anteriores',
        ],
        correctIndices: [3],
        explanation: {
          whyCorrect: 'Todas las comprobaciones son obligatorias.',
          riskIdentified: 'Atrapamiento.',
          consequences: 'Lesiones graves.',
          preventiveMeasures: 'Lista de chequeo previa.',
          legalReference: 'RD 1215/1997',
        },
        points: 20,
        timeSeconds: 45,
        active: true,
      };

      for (let i = 0; i < 40; i++) {
        const presented = shuffleQuestionOptions(customQ);
        expect(presented.options[3]).toBe('Todas las anteriores');
        expect(presented.optionIds![3]).toBe('q_custom_dep_opt_3');
        expect(presented.correctOptionIds).toEqual(['q_custom_dep_opt_3']);
        expect(presented.correctIndices).toEqual([3]);
      }
    });

    it('valida respuestas por ID estable (test, epi_select y ordering) aunque cambie la posición visual', () => {
      const orderingSource = INITIAL_QUESTION_BANK.find((q) => q.type === 'ordering')!;
      const epiSource = INITIAL_QUESTION_BANK.find((q) => q.type === 'epi_select')!;

      const state = createInitialRoomState('IDVAL1', { mode: 'teams', teamCount: 2 });
      joinPlayerToState(state, { playerId: 'p1', playerName: 'Ana', preferredTeamId: 'team_1' });
      executeTeacherCommandServerSide(state, { kind: 'START_GAME' });

      // 1) Ordering: forzar pregunta ordering barajada y responder por IDs canónicos en orden
      executeTeacherCommandServerSide(
        state,
        { kind: 'FORCE_QUESTION', questionId: orderingSource.id },
        INITIAL_QUESTION_BANK
      );
      const presentedOrder = state.activeChallenge!.question!;
      const canonicalOrderIds = orderingSource.correctIndices.map(
        (idx) => `${orderingSource.id}_opt_${idx}`
      );
      expect(presentedOrder.optionIds).toHaveLength(orderingSource.options.length);
      expect(presentedOrder.correctOptionIds).toEqual(canonicalOrderIds);

      // Orden invertido falla aunque coincida algún ID
      const wrongOrder = submitAnswerServerSide(state, 'p1', [...canonicalOrderIds].reverse(), true);
      expect(wrongOrder.ok).toBe(true);
      expect(wrongOrder.isCorrect).toBe(false);

      // Reiniciar con REPEAT_QUESTION re-baraja sin perder validación por ID
      executeTeacherCommandServerSide(state, { kind: 'REPEAT_QUESTION' }, INITIAL_QUESTION_BANK);
      const rightOrder = submitAnswerServerSide(state, 'p1', canonicalOrderIds, true);
      expect(rightOrder.ok).toBe(true);
      expect(rightOrder.isCorrect).toBe(true);

      // 2) EPI multi-select: validar conjunto completo de IDs independientemente del orden
      executeTeacherCommandServerSide(
        state,
        { kind: 'FORCE_QUESTION', questionId: epiSource.id },
        INITIAL_QUESTION_BANK
      );
      const epiIdsReversed = epiSource.correctIndices
        .map((idx) => `${epiSource.id}_opt_${idx}`)
        .reverse();
      const epiRes = submitAnswerServerSide(state, 'p1', epiIdsReversed, true);
      expect(epiRes.ok).toBe(true);
      expect(epiRes.isCorrect).toBe(true);
    });

    it('sincroniza exactamente el mismo orden a todos los clientes y NO filtra la respuesta correcta antes de responder', async () => {
      const { harness, created, teacherSock, students } = await createMultiplayerFixture({
        studentCount: 2,
        mode: 'individual',
        teacherParticipatesAsPlayer: true,
      });

      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'sync_start',
        teacherToken: created.teacherToken,
        command: { kind: 'START_GAME' },
      });

      const dieSpy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((arr) => {
        (arr as Uint32Array)[0] = 0; // Dado = 1 -> Casilla 2 (Pregunta), Fisher-Yates índice j = 0 -> determinista pero barajado distinto de identidad o verificable
        return arr;
      });
      try {
        await harness.sendWs(created.roomCode, teacherSock, {
          type: 'ROLL_DICE',
          actionId: 'sync_roll_1',
          playerId: created.playerId,
          playerToken: created.playerToken,
        });
      } finally {
        dieSpy.mockRestore();
      }

      const teacherState = teacherSock.latestState();
      const student1State = students[0].sock.latestState();
      const student2State = students[1].sock.latestState();

      const tQ = teacherState.activeChallenge?.question;
      const s1Q = student1State.activeChallenge?.question;
      const s2Q = student2State.activeChallenge?.question;

      expect(tQ).toBeDefined();
      expect(s1Q?.options).toEqual(tQ?.options);
      expect(s1Q?.optionIds).toEqual(tQ?.optionIds);
      expect(s2Q?.options).toEqual(tQ?.options);
      expect(s2Q?.optionIds).toEqual(tQ?.optionIds);

      // Seguridad: ni profesor ni alumnos reciben correctIndices ni correctOptionIds antes de responder
      expect(tQ?.correctIndices).toEqual([]);
      expect(tQ?.correctOptionIds).toBeUndefined();
      expect(s1Q?.correctIndices).toEqual([]);
      expect(s1Q?.correctOptionIds).toBeUndefined();

      // GET /api/rooms/:code también viene saneado
      const getStateRes = await harness.httpFetch(`/api/rooms/${created.roomCode}`);
      expect(getStateRes.status).toBe(200);
      const stateJson = (await getStateRes.json()) as { state: GameRoomState };
      expect(stateJson.state.activeChallenge?.question?.correctIndices).toEqual([]);
      expect(stateJson.state.activeChallenge?.question?.correctOptionIds).toBeUndefined();
      expect(stateJson.state.activeChallenge?.question?.optionIds).toEqual(tQ?.optionIds);

      // Enviar respuesta correcta por optionId estable -> tras responder sí revela correctIndices y correctOptionIds
      const bankQ = INITIAL_QUESTION_BANK.find((q) => q.id === tQ!.id)!;
      const rightIds = bankQ.correctIndices.map((idx) => `${bankQ.id}_opt_${idx}`);

      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'SUBMIT_ANSWER',
        actionId: 'sync_ans_1',
        playerId: created.playerId,
        selectedOptionIds: rightIds,
        collaborated: true,
        playerToken: created.playerToken,
      });

      const revealedTeacherQ = teacherSock.latestState().activeChallenge!.question!;
      const revealedStudentQ = students[0].sock.latestState().activeChallenge!.question!;
      expect(teacherSock.latestState().activeChallenge?.answered).toBe(true);
      expect(teacherSock.latestState().activeChallenge?.isCorrect).toBe(true);
      expect(revealedTeacherQ.correctOptionIds).toEqual(rightIds);
      expect(revealedTeacherQ.correctIndices.length).toBeGreaterThan(0);
      expect(revealedStudentQ.correctIndices).toEqual(revealedTeacherQ.correctIndices);
    });
  });

  describe('2. Expulsión de jugadores por el Host (KICK_PLAYER)', () => {
    it('expulsa al jugador, cierra su WebSocket con 4003/PLAYER_KICKED, invalida sus acciones/reingreso y libera plaza', async () => {
      const { harness, created, teacherSock, students } = await createMultiplayerFixture({
        studentCount: 2,
        mode: 'individual',
        maxPlayers: 3, // Host + Alumno 1 + Alumno 2 = sala llena (3/3)
        teacherParticipatesAsPlayer: true,
      });

      const stu1 = students[0];
      const stu2 = students[1];

      // Sala llena en lobby: intentar añadir un 4º participante antes de expulsar debe dar 409 ROOM_FULL
      const fullRes = await harness.httpFetch(`/api/rooms/${created.roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: 'Alumno Extra' }),
      });
      expect(fullRes.status).toBe(409);

      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'kick_start',
        teacherToken: created.teacherToken,
        command: { kind: 'START_GAME' },
      });

      // Un alumno NO puede expulsar a nadie ni usar KICK_PLAYER
      const stuKickAttempt = await harness.httpFetch(`/api/rooms/${created.roomCode}/teacher-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Teacher-Token': stu1.playerToken },
        body: JSON.stringify({
          actionId: 'unauthorized_kick',
          teacherToken: stu1.playerToken,
          command: { kind: 'KICK_PLAYER', playerId: stu2.playerId },
        }),
      });
      expect(stuKickAttempt.status).toBe(401);

      // El Host NO puede expulsarse a sí mismo
      const selfKickRes = await harness.httpFetch(`/api/rooms/${created.roomCode}/teacher-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Teacher-Token': created.teacherToken },
        body: JSON.stringify({
          actionId: 'self_kick_attempt',
          teacherToken: created.teacherToken,
          command: { kind: 'KICK_PLAYER', playerId: created.playerId },
        }),
      });
      expect(selfKickRes.status).toBe(400);

      // Turno actual es de Host (created.playerId). Expulsar a Alumno 2 (NO tiene el turno) -> conserva turno del Host
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'kick_stu2_nonactive',
        teacherToken: created.teacherToken,
        command: { kind: 'KICK_PLAYER', playerId: stu2.playerId },
      });

      expect(stu2.sock.closed).toBe(true);
      expect(stu2.sock.closedCode).toBe(4003);
      expect(stu2.sock.errors().some((e) => e.code === 'PLAYER_KICKED')).toBe(true);

      const afterKick2 = teacherSock.latestState();
      expect(afterKick2.players.some((p) => p.id === stu2.playerId)).toBe(false);
      expect(afterKick2.activePlayerId).toBe(created.playerId);

      // Alumno 2 expulsado NO puede enviar acciones con su token ni reconectar con su playerId/token anterior
      const actionAfterKick = await harness.httpFetch(`/api/rooms/${created.roomCode}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Player-Token': stu2.playerToken,
          'X-Player-Id': stu2.playerId,
        },
        body: JSON.stringify({
          type: 'ROLL_DICE',
          actionId: 'kicked_roll_attempt',
          playerId: stu2.playerId,
          playerToken: stu2.playerToken,
        }),
      });
      expect(actionAfterKick.status).toBe(403);
      expect(((await actionAfterKick.json()) as { error?: string }).error).toBe('PLAYER_KICKED');

      const rejoinAfterKick = await harness.httpFetch(`/api/rooms/${created.roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: stu2.playerId,
          playerName: stu2.playerName,
          playerToken: stu2.playerToken,
        }),
      });
      expect(rejoinAfterKick.status).toBe(403);
      expect(((await rejoinAfterKick.json()) as { error?: string }).error).toBe('PLAYER_KICKED');

      // Ahora sí hay plaza libre (Host + Alumno 1 = 2/3) -> habilitar lateJoin y unir nuevo Alumno 3
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'allow_late_after_kick',
        teacherToken: created.teacherToken,
        command: { kind: 'UPDATE_CONFIG', partialConfig: { allowLateJoin: true } },
      });
      const newJoinRes = await harness.httpFetch(`/api/rooms/${created.roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: 'Alumno Nuevo' }),
      });
      expect(newJoinRes.status).toBe(200);
      const joined3 = (await newJoinRes.json()) as { playerId: string };

      // Avanzar turno hacia Alumno 1 y luego expulsar al jugador que SÍ tiene el turno actual -> pasa al siguiente activo
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'advance_to_stu1',
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      expect(teacherSock.latestState().activePlayerId).toBe(stu1.playerId);

      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'kick_active_stu1',
        teacherToken: created.teacherToken,
        command: { kind: 'KICK_PLAYER', playerId: stu1.playerId },
      });
      const afterActiveKick = teacherSock.latestState();
      expect(afterActiveKick.players.some((p) => p.id === stu1.playerId)).toBe(false);
      expect(afterActiveKick.activePlayerId).toBe(joined3.playerId);
      expect(afterActiveKick.phase).toBe('waiting_roll');
    });

    it('redirige al cliente expulsado fuera de la partida mostrando aviso claro en useGameStore', () => {
      const disconnectSpy = vi.spyOn(mpClient, 'disconnect').mockImplementation(() => {});
      try {
        const roomState = createInitialRoomState('KICKUX', { mode: 'individual' });
        useGameStore.setState({
          screen: 'game',
          isRemoteSession: true,
          roomState,
          playerId: 'stu_expulsado',
          playerToken: 'secret-token',
          errorMessage: null,
        });

        useGameStore.getState().applyServerMessage({
          type: 'ERROR',
          code: 'PLAYER_KICKED',
          message: 'Has sido expulsado de la sala por el profesor.',
        });

        const st = useGameStore.getState();
        expect(st.screen).toBe('create_join');
        expect(st.roomState).toBeNull();
        expect(st.playerToken).toBe('');
        expect(st.errorMessage).toContain('Has sido expulsado de la sala por el profesor.');
        expect(disconnectSpy).toHaveBeenCalled();
      } finally {
        disconnectSpy.mockRestore();
      }
    });
  });

  describe('3. Botón «Saltar turno» autoritativo e idempotente (FORCE_NEXT_TURN)', () => {
    it('permite solo al Host saltar exactamente 1 turno sin tirar dado ni mover fichas, conserva al jugador ausente y evita reasignar a expulsados', async () => {
      const { harness, created, teacherSock, students } = await createMultiplayerFixture({
        studentCount: 2,
        mode: 'individual',
        teacherParticipatesAsPlayer: true,
      });

      const stu1 = students[0];
      const stu2 = students[1];

      // En lobby debe rechazarse saltar turno
      const lobbySkip = await harness.httpFetch(`/api/rooms/${created.roomCode}/teacher-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Teacher-Token': created.teacherToken },
        body: JSON.stringify({
          actionId: 'skip_in_lobby',
          command: { kind: 'FORCE_NEXT_TURN' },
        }),
      });
      expect(lobbySkip.status).toBe(400);

      // Iniciar partida: orden individual Host -> Alumno 1 -> Alumno 2
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'skip_start',
        teacherToken: created.teacherToken,
        command: { kind: 'START_GAME' },
      });
      expect(teacherSock.latestState().activePlayerId).toBe(created.playerId);

      // Un alumno intenta saltar turno -> 401 UNAUTHORIZED_TEACHER
      const stuSkip = await harness.httpFetch(`/api/rooms/${created.roomCode}/teacher-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Teacher-Token': stu1.playerToken },
        body: JSON.stringify({
          actionId: 'stu_forged_skip',
          command: { kind: 'FORCE_NEXT_TURN' },
        }),
      });
      expect(stuSkip.status).toBe(401);

      // Pausar partida -> saltar turno debe estar bloqueado mientras está pausada
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'pause_before_skip',
        teacherToken: created.teacherToken,
        command: { kind: 'PAUSE_GAME' },
      });
      const pausedSkip = await harness.httpFetch(`/api/rooms/${created.roomCode}/teacher-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Teacher-Token': created.teacherToken },
        body: JSON.stringify({
          actionId: 'skip_while_paused',
          command: { kind: 'FORCE_NEXT_TURN' },
        }),
      });
      expect(pausedSkip.status).toBe(400);

      // Reanudar partida
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'resume_after_pause',
        teacherToken: created.teacherToken,
        command: { kind: 'RESUME_GAME' },
      });

      // Avanzar manualmente al turno de Alumno 1, que se desconecta (ausente)
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'skip_host_to_s1',
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      expect(teacherSock.latestState().activePlayerId).toBe(stu1.playerId);
      await harness.closeSocket(created.roomCode, stu1.sock);
      expect(
        teacherSock.latestState().players.find((p) => p.id === stu1.playerId)?.connected
      ).toBe(false);

      const positionsBeforeSkip = teacherSock.latestState().teams.map((t) => t.position);
      const turnBeforeSkip = teacherSock.latestState().turnNumber;

      // Enviar el MISMO actionId por WS + duplicado WS + duplicado HTTP -> SOLO debe saltar 1 turno (Alumno 1 -> Alumno 2)
      const skipActionId = 'idempotent_skip_s1_once';
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: skipActionId,
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: skipActionId,
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      const dupHttpSkip = await harness.httpFetch(
        `/api/rooms/${created.roomCode}/teacher-action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Teacher-Token': created.teacherToken },
          body: JSON.stringify({
            actionId: skipActionId,
            command: { kind: 'FORCE_NEXT_TURN' },
          }),
        }
      );
      expect(dupHttpSkip.status).toBe(200);
      const dupJson = (await dupHttpSkip.json()) as { deduplicated?: boolean; state: GameRoomState };
      expect(dupJson.deduplicated).toBe(true);

      const afterSkip = teacherSock.latestState();
      expect(afterSkip.activePlayerId).toBe(stu2.playerId);
      expect(afterSkip.lastDiceRoll).toBeNull();
      expect(afterSkip.teams.map((t) => t.position)).toEqual(positionsBeforeSkip);
      expect(stu2.sock.latestState().activePlayerId).toBe(stu2.playerId);
      expect(afterSkip.turnNumber).toBe(turnBeforeSkip);

      // El jugador saltado (Alumno 1) sigue en la sala y en la siguiente ronda recupera su turno normalmente
      expect(afterSkip.players.some((p) => p.id === stu1.playerId)).toBe(true);
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'skip_s2_to_host',
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      expect(teacherSock.latestState().activePlayerId).toBe(created.playerId);
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'skip_host_to_s1_round2',
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      expect(teacherSock.latestState().activePlayerId).toBe(stu1.playerId);

      // Si se expulsa a Alumno 2 mientras Host tiene el turno y luego Host salta turno, nunca asigna al expulsado
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'skip_s1_to_s2',
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'skip_s2_to_host_2',
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'kick_stu2_before_skip',
        teacherToken: created.teacherToken,
        command: { kind: 'KICK_PLAYER', playerId: stu2.playerId },
      });
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'skip_host_after_s2_kick',
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });
      expect(teacherSock.latestState().activePlayerId).toBe(stu1.playerId);
      expect(teacherSock.latestState().activePlayerId).not.toBe(stu2.playerId);

      // Partida finalizada no permite saltar turno
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: 'end_game_for_skip_check',
        teacherToken: created.teacherToken,
        command: { kind: 'END_GAME' },
      });
      const finishedSkip = await harness.httpFetch(
        `/api/rooms/${created.roomCode}/teacher-action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Teacher-Token': created.teacherToken },
          body: JSON.stringify({
            actionId: 'skip_when_finished',
            command: { kind: 'FORCE_NEXT_TURN' },
          }),
        }
      );
      expect(finishedSkip.status).toBe(400);
    });

    it('sincroniza correctamente Saltar turno y Expulsar con 15 participantes simultáneos en sala', async () => {
      const { harness, created, teacherSock, students } = await createMultiplayerFixture({
        studentCount: 15,
        mode: 'individual',
        maxPlayers: 15,
        teacherParticipatesAsPlayer: false,
      });

      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: '15_start',
        teacherToken: created.teacherToken,
        command: { kind: 'START_GAME' },
      });
      expect(teacherSock.latestState().activePlayerId).toBe(students[0].playerId);

      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: '15_skip_first',
        teacherToken: created.teacherToken,
        command: { kind: 'FORCE_NEXT_TURN' },
      });

      for (const stu of students) {
        expect(stu.sock.latestState().activePlayerId).toBe(students[1].playerId);
      }

      // Expulsar al participante 15 y verificar sincronización inmediata en todos los sockets restantes
      await harness.sendWs(created.roomCode, teacherSock, {
        type: 'TEACHER_ACTION',
        actionId: '15_kick_last',
        teacherToken: created.teacherToken,
        command: { kind: 'KICK_PLAYER', playerId: students[14].playerId },
      });
      expect(students[14].sock.closed).toBe(true);
      expect(teacherSock.latestState().players.filter((p) => !p.isTeacher)).toHaveLength(14);
      expect(students[1].sock.latestState().players.filter((p) => !p.isTeacher)).toHaveLength(14);
      // Turno actual (Alumno 2) permanece intacto
      expect(students[1].sock.latestState().activePlayerId).toBe(students[1].playerId);
    });
  });

  describe('4. Regresiones y compatibilidad sanitizeStateForClient', () => {
    it('no altera la partida cuando se usa sanitizeStateForClient ni oculta explicaciones tras responder', () => {
      const state = createInitialRoomState('SAN1');
      joinPlayerToState(state, { playerId: 'p1', playerName: 'Ana', preferredTeamId: 'team_1' });
      state.status = 'playing';
      rollDiceServerSide(state, 'p1', INITIAL_QUESTION_BANK, () => 1);

      const beforeAnswerWire = sanitizeStateForClient(state);
      expect(beforeAnswerWire.activeChallenge?.question?.correctIndices).toEqual([]);
      expect(beforeAnswerWire.activeChallenge?.question?.correctOptionIds).toBeUndefined();
      // El estado autoritativo interno sigue intacto
      expect(state.activeChallenge?.question?.correctIndices.length).toBeGreaterThan(0);
      expect(state.activeChallenge?.question?.correctOptionIds?.length).toBeGreaterThan(0);

      submitAnswerServerSide(
        state,
        'p1',
        state.activeChallenge!.question!.correctOptionIds!,
        true
      );
      const afterAnswerWire = sanitizeStateForClient(state);
      expect(afterAnswerWire.activeChallenge?.answered).toBe(true);
      expect(afterAnswerWire.activeChallenge?.question?.correctIndices.length).toBeGreaterThan(0);
      expect(
        afterAnswerWire.activeChallenge?.question?.correctOptionIds?.length
      ).toBeGreaterThan(0);
    });
  });
});
