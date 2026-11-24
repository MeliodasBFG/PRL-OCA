import {
  ClientMessageSchema,
  ClientToServerMessage,
  GameConfig,
  GameRoomState,
  JoinRoomRequestSchema,
  RoomJoinErrorCode,
  ServerToClientMessage,
  TeacherCommandSchema,
  buildMatchHistoryFromState,
  advanceTurnServerSide,
  canPlayerActOnTeamTurn,
  completeChallenge3DServerSide,
  createInitialRoomState,
  disconnectPlayerFromState,
  evaluateJoinEligibility,
  executeTeacherCommandServerSide,
  isValidRoomCodeFormat,
  joinPlayerToState,
  normalizeRoomCode,
  refreshAllTeamRoles,
  rollDiceServerSide,
  submitAnswerServerSide,
} from '@prl-oca/shared';
import {
  RateLimiter,
  buildCorsHeaders,
  createPlayerToken,
  createTeacherToken,
  isOriginAllowed,
  verifyPlayerToken,
  verifyTeacherToken,
} from '../security/auth';
import { DatabaseService } from '../services/db';

export interface Env {
  GAME_ROOMS: DurableObjectNamespace;
  DB?: D1Database;
  ASSETS_BUCKET?: R2Bucket;
  ALLOWED_ORIGIN?: string;
  ENVIRONMENT?: string;
  TEACHER_TOKEN_SECRET?: string;
  TEACHER_ADMIN_SECRET?: string;
  TEACHER_CREATE_SECRET?: string;
}

interface SocketAttachment {
  playerId: string;
  isTeacher?: boolean;
  isSpectator?: boolean;
}

type VerifiedRoomLoadResult =
  | { ok: true; state: GameRoomState; closed: boolean }
  | { ok: false; status: number; error: RoomJoinErrorCode; message: string };

/**
 * Durable Object `GameRoom`
 * Manages the authoritative state of a single PRL-OCA 3D match room (up to 15 players + teacher + spectators)
 * using Cloudflare Durable Objects WebSocket Hibernation API.
 * Strictly requires explicit initialization (`room_initialized === true`) before accepting state reads, joins, or WebSockets.
 */
export class GameRoom {
  private stateData: GameRoomState | null = null;
  private teacherPin: string = crypto.randomUUID();
  private processedActionIds = new Set<string>();
  private processedActionResults = new Map<string, ServerToClientMessage>();
  private processedActionsLoaded = false;
  private gameplayLock: Promise<void> = Promise.resolve();
  private rateLimiter = new RateLimiter(45, 5000);
  private socketPlayers = new Map<WebSocket, SocketAttachment>();

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env
  ) {}

  private async runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.gameplayLock;
    let release!: () => void;
    this.gameplayLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async loadVerifiedExistingRoom(
    expectedRoomCode?: string
  ): Promise<VerifiedRoomLoadResult> {
    const initialized = await this.ctx.storage.get<boolean>('room_initialized');
    const closedFlag = await this.ctx.storage.get<boolean>('room_closed');
    const storedCode = await this.ctx.storage.get<string>('room_code');
    const storedPin = await this.ctx.storage.get<string>('teacher_pin');
    const storedState = this.stateData ?? (await this.ctx.storage.get<GameRoomState>('room_state'));

    if (initialized !== true || !storedState) {
      return {
        ok: false,
        status: 404,
        error: 'ROOM_NOT_FOUND',
        message: 'No existe ninguna partida con ese código.',
      };
    }

    const persistedCode = normalizeRoomCode(storedCode ?? storedState.roomCode);
    if (expectedRoomCode && persistedCode !== normalizeRoomCode(expectedRoomCode)) {
      return {
        ok: false,
        status: 404,
        error: 'ROOM_NOT_FOUND',
        message: 'No existe ninguna partida con ese código.',
      };
    }

    this.stateData = storedState;
    if (storedPin) this.teacherPin = storedPin;

    const isClosed = closedFlag === true || storedState.status === 'closed';
    return { ok: true, state: storedState, closed: isClosed };
  }

  private async persist(): Promise<void> {
    if (this.stateData) {
      await this.ctx.storage.put('room_code', this.stateData.roomCode);
      await this.ctx.storage.put('room_state', this.stateData);
    }
  }

  private async ensureProcessedActionsLoaded(): Promise<void> {
    if (this.processedActionsLoaded) return;
    this.processedActionsLoaded = true;
    const saved = await this.ctx.storage.get<Record<string, ServerToClientMessage>>(
      'processed_actions'
    );
    if (saved && typeof saved === 'object') {
      for (const [id, ev] of Object.entries(saved)) {
        this.processedActionIds.add(id);
        this.processedActionResults.set(id, ev);
      }
    }
  }

  private async recordProcessedAction(
    actionId: string,
    event: ServerToClientMessage
  ): Promise<void> {
    this.processedActionIds.add(actionId);
    this.processedActionResults.set(actionId, event);
    if (this.processedActionResults.size > 100) {
      const oldestKey = this.processedActionResults.keys().next().value;
      if (oldestKey) this.processedActionResults.delete(oldestKey);
    }

    // Persist the most recent 6 action results cleanly within Durable Object storage limits
    const entries = Array.from(this.processedActionResults.entries()).slice(-6);
    await this.ctx.storage.put('processed_actions', Object.fromEntries(entries));
  }

  private jsonError(
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
      {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }
    );
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get('Origin');
    const cors = buildCorsHeaders(
      this.env.ALLOWED_ORIGIN ?? '*',
      requestOrigin,
      this.env.ENVIRONMENT ?? 'development'
    );

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const rawRoomCode = url.searchParams.get('roomCode') ?? '';
    const roomCode = normalizeRoomCode(rawRoomCode);

    // Check whether code slot is already occupied (used during collision-free room creation)
    if (request.method === 'GET' && url.pathname.endsWith('/exists')) {
      const initialized = await this.ctx.storage.get<boolean>('room_initialized');
      const closed = await this.ctx.storage.get<boolean>('room_closed');
      const existingState = this.stateData ?? (await this.ctx.storage.get<GameRoomState>('room_state'));
      const active =
        initialized === true &&
        closed !== true &&
        Boolean(existingState) &&
        existingState?.status !== 'closed' &&
        existingState?.status !== 'finished';
      return new Response(JSON.stringify({ ok: true, exists: active }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Initialize / Configure Room EXCLUSIVELY via POST /init (Teacher creation only)
    if (request.method === 'POST' && url.pathname.endsWith('/init')) {
      const body = (await request.json().catch(() => ({}))) as {
        roomCode?: string;
        config?: Partial<GameConfig>;
        teacherPin?: string;
        teacherName?: string;
        teacherId?: string;
        teacherParticipatesAsPlayer?: boolean;
      };
      const code = normalizeRoomCode(body.roomCode ?? roomCode);
      if (!isValidRoomCodeFormat(code)) {
        return this.jsonError(400, 'INVALID_ROOM_CODE', 'Formato de código de sala incorrecto.', cors);
      }

      const alreadyInitialized = await this.ctx.storage.get<boolean>('room_initialized');
      const alreadyClosed = await this.ctx.storage.get<boolean>('room_closed');
      const existingState =
        this.stateData ?? (await this.ctx.storage.get<GameRoomState>('room_state'));
      if (
        alreadyInitialized === true &&
        alreadyClosed !== true &&
        existingState &&
        existingState.status !== 'closed' &&
        existingState.status !== 'finished'
      ) {
        return this.jsonError(
          409,
          'ROOM_ALREADY_EXISTS',
          'Ese código de sala ya se encuentra ocupado.',
          cors
        );
      }

      this.teacherPin = body.teacherPin?.trim() || crypto.randomUUID().slice(0, 8);
      this.stateData = createInitialRoomState(code, body.config);

      let resolvedTeacherId: string | undefined;
      let playerToken: string | undefined;
      if (body.teacherId?.trim() || body.teacherName?.trim()) {
        resolvedTeacherId =
          body.teacherId?.trim() || `teacher_${crypto.randomUUID().slice(0, 8)}`;
        const teacherName = body.teacherName?.trim() || 'Docente PRL';
        joinPlayerToState(this.stateData, {
          playerId: resolvedTeacherId,
          playerName: teacherName,
          isTeacher: true,
          participatesAsPlayer: Boolean(body.teacherParticipatesAsPlayer),
        });
        await this.ctx.storage.put('teacher_id', resolvedTeacherId);
        playerToken = createPlayerToken(
          code,
          resolvedTeacherId,
          this.teacherPin,
          this.env.TEACHER_TOKEN_SECRET
        );
      }

      await this.ctx.storage.put('room_initialized', true);
      await this.ctx.storage.put('room_closed', false);
      await this.ctx.storage.put('room_code', code);
      await this.ctx.storage.put('teacher_pin', this.teacherPin);
      await this.persist();
      const teacherToken = createTeacherToken(
        code,
        this.teacherPin,
        this.env.TEACHER_TOKEN_SECRET
      );
      console.log(
        `[DO:${code}] Room initialized (maxPlayers=${this.stateData.config.maxPlayers}, teacherRegistered=${Boolean(resolvedTeacherId)})`
      );
      return new Response(
        JSON.stringify({
          success: true,
          ok: true,
          roomCode: code,
          playerId: resolvedTeacherId,
          playerToken,
          teacherToken,
          state: this.stateData,
        }),
        {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!isValidRoomCodeFormat(roomCode)) {
      return this.jsonError(
        400,
        'INVALID_ROOM_CODE',
        'Formato de código de sala incorrecto.',
        cors
      );
    }

    // Read Room State via GET /state (NEVER creates or initializes a room)
    if (request.method === 'GET' && url.pathname.endsWith('/state')) {
      const loaded = await this.loadVerifiedExistingRoom(roomCode);
      if (!loaded.ok) {
        return this.jsonError(loaded.status, loaded.error, loaded.message, cors);
      }
      if (loaded.closed) {
        return this.jsonError(
          410,
          'ROOM_CLOSED',
          'Esta partida ha sido cerrada por el profesor.',
          cors
        );
      }
      return new Response(JSON.stringify({ success: true, ok: true, state: loaded.state }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Validate & authorize joining an existing room -> POST /join (NEVER initializes a room)
    if (request.method === 'POST' && url.pathname.endsWith('/join')) {
      const loaded = await this.loadVerifiedExistingRoom(roomCode);
      if (!loaded.ok) {
        return this.jsonError(loaded.status, loaded.error, loaded.message, cors);
      }
      if (loaded.closed) {
        return this.jsonError(
          410,
          'ROOM_CLOSED',
          'Esta partida ha sido cerrada por el profesor.',
          cors
        );
      }

      const rawBody = await request.json().catch(() => ({}));
      const parsedJoin = JoinRoomRequestSchema.safeParse(rawBody);
      if (!parsedJoin.success) {
        return this.jsonError(
          400,
          'JOIN_REJECTED',
          'Datos de acceso a la sala no válidos.',
          cors
        );
      }

      const reqData = parsedJoin.data;
      const requestedPlayerId =
        reqData.playerId?.trim() || `plr_${crypto.randomUUID().slice(0, 8)}`;
      const wantTeacher = Boolean(reqData.isTeacher);
      const wantSpectator = Boolean(reqData.isSpectator);

      let issuedTeacherToken: string | undefined;
      if (wantTeacher) {
        if (!reqData.teacherPin || reqData.teacherPin.trim() !== this.teacherPin) {
          return this.jsonError(
            403,
            'INVALID_TEACHER_PIN',
            'Clave o PIN de docente incorrecto.',
            cors
          );
        }
        issuedTeacherToken = createTeacherToken(
          loaded.state.roomCode,
          this.teacherPin,
          this.env.TEACHER_TOKEN_SECRET
        );
      }

      const eligibility = evaluateJoinEligibility(loaded.state, {
        playerId: requestedPlayerId,
        playerName: reqData.playerName,
        isTeacher: wantTeacher,
        isSpectator: wantSpectator,
        participatesAsPlayer: reqData.participatesAsPlayer,
      });

      if (!eligibility.ok) {
        const statusMap: Partial<Record<RoomJoinErrorCode, number>> = {
          ROOM_CLOSED: 410,
          ROOM_FINISHED: 403,
          ROOM_NOT_JOINABLE: 403,
          ROOM_FULL: 409,
        };
        const status = (eligibility.errorCode && statusMap[eligibility.errorCode]) ?? 403;
        return this.jsonError(
          status,
          eligibility.errorCode ?? 'JOIN_REJECTED',
          eligibility.error ?? 'No es posible unirse a esta sala.',
          cors
        );
      }

      const existing = eligibility.existingPlayer;
      if (existing) {
        if (reqData.playerToken) {
          const tokenValid = verifyPlayerToken(
            reqData.playerToken,
            loaded.state.roomCode,
            existing.id,
            this.teacherPin,
            this.env.TEACHER_TOKEN_SECRET
          );
          if (!tokenValid) {
            return this.jsonError(
              401,
              'INVALID_PLAYER_TOKEN',
              'Token de participante inválido o perteneciente a otro jugador.',
              cors
            );
          }
        } else if (
          existing.id === requestedPlayerId &&
          !wantTeacher &&
          this.hasOpenSocketForPlayer(existing.id)
        ) {
          return this.jsonError(
            403,
            'UNAUTHORIZED_PLAYER',
            'Ese participante ya tiene una sesión activa en curso.',
            cors
          );
        }
      } else if (reqData.playerToken) {
        // Cannot join as a brand new identity while presenting someone else's token
        return this.jsonError(
          401,
          'INVALID_PLAYER_TOKEN',
          'Token de participante no válido para un nuevo registro.',
          cors
        );
      }

      // Authoritatively register or reconnect participant on the Durable Object immediately on HTTP /join
      const joinRes = joinPlayerToState(loaded.state, {
        playerId: existing?.id ?? requestedPlayerId,
        playerName: reqData.playerName,
        preferredTeamId: reqData.preferredTeamId,
        isTeacher: wantTeacher,
        isSpectator: wantSpectator,
        participatesAsPlayer: reqData.participatesAsPlayer,
      });

      if (!joinRes.ok || !joinRes.player) {
        return this.jsonError(
          403,
          joinRes.errorCode ?? 'JOIN_REJECTED',
          joinRes.error ?? 'No fue posible registrar al participante en la sala.',
          cors
        );
      }

      const resolvedPlayerId = joinRes.player.id;
      const playerToken = createPlayerToken(
        loaded.state.roomCode,
        resolvedPlayerId,
        this.teacherPin,
        this.env.TEACHER_TOKEN_SECRET
      );

      await this.persist();
      this.broadcast({ type: 'STATE_SYNC', state: loaded.state });

      console.log(
        `[DO:${loaded.state.roomCode}] HTTP /join registered playerId=${resolvedPlayerId} reconnected=${Boolean(joinRes.reconnected)} players=${loaded.state.players.length} status=${loaded.state.status}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          ok: true,
          roomCode: loaded.state.roomCode,
          playerId: resolvedPlayerId,
          playerToken,
          teacherToken: issuedTeacherToken,
          reconnected: Boolean(joinRes.reconnected),
          state: loaded.state,
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Authoritative HTTP fallback for authenticated player gameplay actions -> POST /action
    if (request.method === 'POST' && url.pathname.endsWith('/action')) {
      const loaded = await this.loadVerifiedExistingRoom(roomCode);
      if (!loaded.ok) {
        return this.jsonError(loaded.status, loaded.error, loaded.message, cors);
      }
      if (loaded.closed) {
        return this.jsonError(
          410,
          'ROOM_CLOSED',
          'Esta partida ha sido cerrada por el profesor.',
          cors
        );
      }

      const rawBody = (await request.json().catch(() => null)) as {
        playerId?: string;
        playerToken?: string;
        message?: unknown;
      } | null;
      const bearerToken = request.headers
        .get('Authorization')
        ?.replace(/^Bearer\s+/i, '')
        .trim();
      const headerToken = request.headers.get('X-Player-Token')?.trim() || bearerToken;
      const headerPlayerId = request.headers.get('X-Player-Id')?.trim();
      const parsedAction = ClientMessageSchema.safeParse(rawBody?.message ?? rawBody);
      if (!parsedAction.success) {
        return this.jsonError(400, 'VALIDATION_ERROR', 'Acción de juego inválida.', cors);
      }
      const actionMsg = parsedAction.data;
      if (
        actionMsg.type === 'PING' ||
        actionMsg.type === 'JOIN_ROOM' ||
        actionMsg.type === 'TEACHER_ACTION'
      ) {
        return this.jsonError(400, 'INVALID_GAME_ACTION', 'Tipo de acción no soportada en /action.', cors);
      }

      if (headerPlayerId && headerPlayerId !== actionMsg.playerId) {
        return this.jsonError(
          403,
          'UNAUTHORIZED_PLAYER',
          'La identidad de la cabecera X-Player-Id no coincide con la sesión solicitada.',
          cors
        );
      }

      const suppliedToken =
        ('playerToken' in actionMsg ? actionMsg.playerToken : undefined) ||
        rawBody?.playerToken?.trim() ||
        headerToken;
      if (!suppliedToken) {
        return this.jsonError(
          401,
          'INVALID_PLAYER_TOKEN',
          'Se requiere token de participante para ejecutar acciones por HTTP.',
          cors
        );
      }

      if (!this.rateLimiter.allow(`http:${actionMsg.playerId}`)) {
        return this.jsonError(
          429,
          'RATE_LIMITED',
          'Demasiadas acciones seguidas. Espera unos segundos.',
          cors
        );
      }

      const authRes = await this.runSerialized(async () => {
        const fresh = await this.loadVerifiedExistingRoom(roomCode);
        const targetState = fresh.ok ? fresh.state : loaded.state;
        return this.executeValidatedGameplayAction(null, targetState, {
          ...actionMsg,
          playerToken: suppliedToken,
        });
      });
      if (!authRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            ok: false,
            error: authRes.code,
            message: authRes.message,
            ...(authRes.includeState ? { state: loaded.state } : {}),
          }),
          {
            status: authRes.status,
            headers: { ...cors, 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          ok: true,
          deduplicated: Boolean(authRes.deduplicated),
          event: authRes.event,
          state: loaded.state,
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // HTTP Authoritative fallback for Teacher Actions -> POST /teacher-action
    if (request.method === 'POST' && url.pathname.endsWith('/teacher-action')) {
      const loaded = await this.loadVerifiedExistingRoom(roomCode);
      if (!loaded.ok) {
        return this.jsonError(loaded.status, loaded.error, loaded.message, cors);
      }
      const rawBody = (await request.json().catch(() => ({}))) as {
        teacherToken?: string;
        command?: unknown;
      };
      const headerToken = request.headers.get('X-Teacher-Token')?.trim();
      const token = rawBody.teacherToken?.trim() || headerToken;
      const parsedCmd = TeacherCommandSchema.safeParse(rawBody.command);
      if (!parsedCmd.success) {
        return this.jsonError(400, 'INVALID_COMMAND', 'Comando docente inválido.', cors);
      }
      const cmdResult = await this.executeAuthoritativeTeacherCommand(
        loaded.state,
        token,
        parsedCmd.data,
        'http'
      );
      if (!cmdResult.ok) {
        return this.jsonError(cmdResult.status, cmdResult.code, cmdResult.message, cors);
      }
      return new Response(
        JSON.stringify({
          success: true,
          ok: true,
          gameStarted: cmdResult.state.status === 'playing',
          startedAt: cmdResult.state.startedAt,
          state: cmdResult.state,
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // WebSocket Upgrade for Real-Time Multiplayer -> MUST verify room exists BEFORE accepting WebSocket
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      if (
        !isOriginAllowed(
          requestOrigin,
          this.env.ALLOWED_ORIGIN ?? '*',
          this.env.ENVIRONMENT ?? 'development'
        )
      ) {
        return this.jsonError(403, 'ORIGIN_FORBIDDEN', 'Origen WebSocket no autorizado.', cors);
      }

      const loaded = await this.loadVerifiedExistingRoom(roomCode);
      if (!loaded.ok) {
        console.warn(`[DO:${roomCode}] Rejected WebSocket upgrade: ${loaded.error}`);
        return this.jsonError(loaded.status, loaded.error, loaded.message, cors);
      }
      if (loaded.closed) {
        console.warn(`[DO:${roomCode}] Rejected WebSocket upgrade: ROOM_CLOSED`);
        return this.jsonError(
          410,
          'ROOM_CLOSED',
          'Esta partida ha sido cerrada por el profesor.',
          cors
        );
      }
      if (loaded.state.status === 'finished') {
        console.warn(`[DO:${roomCode}] Rejected WebSocket upgrade: ROOM_FINISHED`);
        return this.jsonError(
          403,
          'ROOM_FINISHED',
          'La partida ya ha finalizado y no admite nuevas conexiones.',
          cors
        );
      }

      const state = loaded.state;
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Use Hibernation API if available in runtime, fallback to standard accept
      if (typeof this.ctx.acceptWebSocket === 'function') {
        this.ctx.acceptWebSocket(server);
      } else {
        server.accept();
        server.addEventListener('message', (evt) => {
          void this.webSocketMessage(server, evt.data);
        });
        server.addEventListener('close', () => {
          void this.webSocketClose(server);
        });
      }

      // Send initial state snapshot (and explicit GAME_STARTED if match already running)
      if (state.status === 'playing') {
        this.sendToSocket(server, {
          type: 'GAME_STARTED',
          roomCode: state.roomCode,
          startedAt: state.startedAt ?? state.updatedAt,
          state,
        });
      }
      this.sendToSocket(server, {
        type: 'STATE_SYNC',
        state,
      });
      console.log(
        `[DO:${state.roomCode}] WebSocket connected (status=${state.status}, totalSockets=${this.getActiveSockets().length})`
      );

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: cors,
      });
    }

    return this.jsonError(404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada en GameRoom', cors);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[DO] Unhandled error in GameRoom.fetch: ${detail}`);
      return this.jsonError(
        500,
        'DURABLE_OBJECT_ERROR',
        `Error en almacenamiento o lógica de Durable Object GameRoom: ${detail}`,
        cors
      );
    }
  }

  public async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    const loaded = await this.loadVerifiedExistingRoom();
    if (!loaded.ok) {
      this.sendToSocket(ws, {
        type: 'ERROR',
        code: loaded.error,
        message: loaded.message,
      });
      try {
        if (typeof ws.close === 'function') ws.close(1008, loaded.error);
      } catch {
        // Ignore
      }
      return;
    }
    if (loaded.closed) {
      this.sendToSocket(ws, {
        type: 'ERROR',
        code: 'ROOM_CLOSED',
        message: 'Esta partida ha sido cerrada por el profesor.',
      });
      try {
        if (typeof ws.close === 'function') ws.close(1000, 'ROOM_CLOSED');
      } catch {
        // Ignore
      }
      return;
    }
    const state = loaded.state;
    const text =
      typeof rawMessage === 'string'
        ? rawMessage
        : new TextDecoder().decode(rawMessage);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      this.sendToSocket(ws, {
        type: 'ERROR',
        code: 'INVALID_JSON',
        message: 'Formato de mensaje WebSocket inválido.',
      });
      return;
    }

    const validation = ClientMessageSchema.safeParse(parsedJson);
    if (!validation.success) {
      this.sendToSocket(ws, {
        type: 'ERROR',
        code: 'VALIDATION_ERROR',
        message: 'Mensaje rechazado por validación de seguridad en el servidor.',
      });
      return;
    }

    const msg: ClientToServerMessage = validation.data;

    if (msg.type === 'PING') {
      this.sendToSocket(ws, { type: 'PONG', timestamp: msg.timestamp });
      return;
    }

    // Rate limit per player/action
    const rateKey = 'playerId' in msg ? msg.playerId : 'teacher';
    if (!this.rateLimiter.allow(rateKey)) {
      this.sendToSocket(ws, {
        type: 'ERROR',
        code: 'RATE_LIMITED',
        message: 'Demasiadas acciones seguidas. Espera unos segundos.',
      });
      return;
    }

    // Deduplicate non-gameplay actions upfront; gameplay actions handle idempotent replay inside runSerialized
    await this.ensureProcessedActionsLoaded();
    const isGameplayAction =
      msg.type === 'TOGGLE_READY' ||
      msg.type === 'SELECT_TEAM' ||
      msg.type === 'ROLL_DICE' ||
      msg.type === 'SUBMIT_ANSWER' ||
      msg.type === 'COMPLETE_CHALLENGE_3D' ||
      msg.type === 'NEXT_TURN';
    if ('actionId' in msg && !isGameplayAction) {
      if (this.processedActionIds.has(msg.actionId)) {
        return;
      }
      this.processedActionIds.add(msg.actionId);
      if (this.processedActionIds.size > 500) {
        const first = this.processedActionIds.values().next().value;
        if (first) this.processedActionIds.delete(first);
      }
    }

    await this.handleValidatedMessage(ws, state, msg);
  }

  private getActiveSockets(): WebSocket[] {
    return typeof this.ctx.getWebSockets === 'function'
      ? this.ctx.getWebSockets()
      : Array.from(this.socketPlayers.keys());
  }

  public async webSocketClose(ws: WebSocket): Promise<void> {
    const loaded = await this.loadVerifiedExistingRoom();
    const att = this.getSocketAttachment(ws);
    this.socketPlayers.delete(ws);
    if (typeof ws.serializeAttachment === 'function') {
      try {
        ws.serializeAttachment({ playerId: '' });
      } catch {
        // Socket already closed
      }
    }

    if (!loaded.ok) return;
    const state = loaded.state;

    if (att?.playerId) {
      // Only mark disconnected when no newer active socket owns this player ID
      const stillHasOtherSocket = this.getActiveSockets().some((other) => {
        if (other === ws) return false;
        return this.getSocketAttachment(other)?.playerId === att.playerId;
      });
      if (!stillHasOtherSocket && disconnectPlayerFromState(state, att.playerId)) {
        await this.persist();
        this.broadcast({ type: 'STATE_SYNC', state });
      }
      console.log(
        `[DO:${state.roomCode}] WebSocket closed playerId=${att.playerId} remainingSockets=${this.getActiveSockets().length}`
      );
    }
  }

  public async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private setSocketAttachment(ws: WebSocket, att: SocketAttachment): void {
    this.socketPlayers.set(ws, att);
    if (typeof ws.serializeAttachment === 'function') {
      ws.serializeAttachment(att);
    }
  }

  private getSocketAttachment(ws: WebSocket): SocketAttachment | undefined {
    if (this.socketPlayers.has(ws)) {
      return this.socketPlayers.get(ws);
    }
    if (typeof ws.deserializeAttachment === 'function') {
      return ws.deserializeAttachment() as SocketAttachment | undefined;
    }
    return undefined;
  }

  private hasOpenSocketForPlayer(playerId: string, excludeWs?: WebSocket): boolean {
    return this.getActiveSockets().some((sock) => {
      if (excludeWs && sock === excludeWs) return false;
      const att = this.getSocketAttachment(sock);
      if (att?.playerId !== playerId) return false;
      if ('readyState' in sock && typeof sock.readyState === 'number') {
        return sock.readyState === 1;
      }
      return true;
    });
  }

  public async handleValidatedMessage(
    ws: WebSocket,
    state: GameRoomState,
    msg: Exclude<ClientToServerMessage, { type: 'PING' }>
  ): Promise<void> {
    switch (msg.type) {
      case 'JOIN_ROOM': {
        let verifiedTeacher = false;
        let issuedToken: string | undefined;
        if (msg.isTeacher) {
          const validPin = Boolean(msg.teacherPin && msg.teacherPin === this.teacherPin);
          const validTok = Boolean(
            msg.teacherToken &&
              verifyTeacherToken(
                msg.teacherToken,
                state.roomCode,
                this.teacherPin,
                this.env.TEACHER_TOKEN_SECRET
              )
          );
          if (validPin || validTok) {
            verifiedTeacher = true;
            issuedToken = createTeacherToken(
              state.roomCode,
              this.teacherPin,
              this.env.TEACHER_TOKEN_SECRET
            );
          } else {
            this.sendToSocket(ws, {
              type: 'ERROR',
              code: 'INVALID_TEACHER_PIN',
              message: 'PIN o credencial de docente incorrecta.',
            });
            return;
          }
        }

        const eligibility = evaluateJoinEligibility(state, {
          playerId: msg.playerId,
          playerName: msg.playerName,
          isTeacher: verifiedTeacher,
          isSpectator: msg.isSpectator,
          participatesAsPlayer: msg.participatesAsPlayer,
        });
        if (!eligibility.ok) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: eligibility.errorCode ?? 'JOIN_REJECTED',
            message: eligibility.error ?? 'No se pudo unir a la sala.',
          });
          return;
        }

        const existingTargetId = eligibility.existingPlayer?.id ?? msg.playerId;
        if (msg.playerToken) {
          const validP = verifyPlayerToken(
            msg.playerToken,
            state.roomCode,
            existingTargetId,
            this.teacherPin,
            this.env.TEACHER_TOKEN_SECRET
          );
          if (!validP) {
            this.sendToSocket(ws, {
              type: 'ERROR',
              code: 'INVALID_PLAYER_TOKEN',
              message: 'Token de sesión de participante inválido o expirado.',
            });
            return;
          }
        } else if (
          eligibility.existingPlayer &&
          eligibility.existingPlayer.id === msg.playerId &&
          !verifiedTeacher &&
          this.hasOpenSocketForPlayer(eligibility.existingPlayer.id, ws)
        ) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: 'UNAUTHORIZED_PLAYER',
            message: 'Este jugador ya está conectado desde otra sesión activa.',
          });
          return;
        }

        const joinRes = joinPlayerToState(state, {
          playerId: existingTargetId,
          playerName: msg.playerName,
          preferredTeamId: msg.preferredTeamId,
          isTeacher: verifiedTeacher,
          isSpectator: msg.isSpectator,
          participatesAsPlayer: msg.participatesAsPlayer,
        });

        if (!joinRes.ok || !joinRes.player) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: joinRes.errorCode ?? 'JOIN_REJECTED',
            message: joinRes.error ?? 'No se pudo unir a la sala.',
          });
          return;
        }

        const resolvedPlayerId = joinRes.player.id;
        const playerToken = createPlayerToken(
          state.roomCode,
          resolvedPlayerId,
          this.teacherPin,
          this.env.TEACHER_TOKEN_SECRET
        );

        this.setSocketAttachment(ws, {
          playerId: resolvedPlayerId,
          isTeacher: verifiedTeacher,
          isSpectator: msg.isSpectator,
        });

        await this.persist();
        if (state.status === 'playing') {
          this.sendToSocket(ws, {
            type: 'GAME_STARTED',
            roomCode: state.roomCode,
            startedAt: state.startedAt ?? state.updatedAt,
            state,
          });
        }
        this.sendToSocket(ws, {
          type: 'STATE_SYNC',
          state,
          yourPlayerId: resolvedPlayerId,
          teacherToken: issuedToken,
          playerToken,
        });
        this.broadcast({ type: 'STATE_SYNC', state }, ws);
        console.log(
          `[DO:${state.roomCode}] JOIN_ROOM playerId=${resolvedPlayerId} isTeacher=${verifiedTeacher} status=${state.status} sockets=${this.getActiveSockets().length}`
        );
        break;
      }

      case 'TOGGLE_READY':
      case 'SELECT_TEAM':
      case 'ROLL_DICE':
      case 'SUBMIT_ANSWER':
      case 'COMPLETE_CHALLENGE_3D':
      case 'NEXT_TURN': {
        const res = await this.runSerialized(async () => {
          const fresh = await this.loadVerifiedExistingRoom(state.roomCode);
          const targetState = fresh.ok ? fresh.state : state;
          return this.executeValidatedGameplayAction(ws, targetState, msg);
        });
        if (!res.ok) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: res.code,
            message: res.message,
            ...(res.includeState ? { state: this.stateData ?? state } : {}),
          });
          return;
        }
        break;
      }

      case 'TEACHER_ACTION': {
        const res = await this.executeAuthoritativeTeacherCommand(
          state,
          msg.teacherToken,
          msg.command,
          'ws',
          ws
        );
        if (!res.ok) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: res.code,
            message: res.message,
          });
          return;
        }
        break;
      }
    }
  }

  private async executeValidatedGameplayAction(
    ws: WebSocket | null,
    state: GameRoomState,
    msg: Extract<
      ClientToServerMessage,
      {
        type:
          | 'TOGGLE_READY'
          | 'SELECT_TEAM'
          | 'ROLL_DICE'
          | 'SUBMIT_ANSWER'
          | 'COMPLETE_CHALLENGE_3D'
          | 'NEXT_TURN';
      }
    >
  ): Promise<
    | { ok: true; deduplicated?: boolean; event: ServerToClientMessage }
    | { ok: false; status: number; code: string; message: string; includeState?: boolean }
  > {
    const db = new DatabaseService(this.env.DB);
    const socketAtt = ws ? this.getSocketAttachment(ws) : undefined;
    const transport = ws ? 'ws' : 'http';
    await this.ensureProcessedActionsLoaded();

    // 1. Validate socket attachment matches target playerId (prevents spoofing another playerId on open socket)
    if (ws && socketAtt?.playerId && socketAtt.playerId !== msg.playerId) {
      console.warn(
        `[DO:${state.roomCode}] UNAUTHORIZED_PLAYER action=${msg.type} transport=${transport} socketPlayer=${socketAtt.playerId} msgPlayer=${msg.playerId}`
      );
      return {
        ok: false,
        status: 403,
        code: 'UNAUTHORIZED_PLAYER',
        message: 'La identidad solicitada no coincide con la sesión autenticada.',
      };
    }

    // 2. Validate playerToken if supplied (prevents using another player's token!)
    if (msg.playerToken) {
      const validToken = verifyPlayerToken(
        msg.playerToken,
        state.roomCode,
        msg.playerId,
        this.teacherPin,
        this.env.TEACHER_TOKEN_SECRET
      );
      if (!validToken) {
        console.warn(
          `[DO:${state.roomCode}] INVALID_PLAYER_TOKEN action=${msg.type} transport=${transport} playerId=${msg.playerId}`
        );
        return {
          ok: false,
          status: 401,
          code: 'INVALID_PLAYER_TOKEN',
          message: 'Credencial de participante inválida o de otro jugador.',
        };
      }
    } else if (ws && !socketAtt?.playerId) {
      return {
        ok: false,
        status: 401,
        code: 'UNAUTHORIZED_PLAYER',
        message: 'Debes registrarte en la sala antes de realizar acciones.',
      };
    }

    // 3. Verify player actually belongs to this room
    const player = state.players.find((pl) => pl.id === msg.playerId);
    if (!player) {
      console.warn(
        `[DO:${state.roomCode}] PLAYER_NOT_FOUND action=${msg.type} transport=${transport} playerId=${msg.playerId}`
      );
      return {
        ok: false,
        status: 404,
        code: 'PLAYER_NOT_FOUND',
        message: 'Jugador no reconocido en la sala.',
      };
    }

    // 4. Idempotent replay check (prevents duplicate dice rolls on HTTP timeouts or WS reconnects)
    if ('actionId' in msg && this.processedActionResults.has(msg.actionId)) {
      const cachedEvent = this.processedActionResults.get(msg.actionId)!;
      console.log(
        `[DO:${state.roomCode}] Deduplicated action=${msg.type} transport=${transport} playerId=${msg.playerId} actionId=${msg.actionId}`
      );
      if (ws) {
        this.sendToSocket(ws, cachedEvent);
      }
      return { ok: true, deduplicated: true, event: cachedEvent };
    }

    const finalizeSuccess = async (event: ServerToClientMessage) => {
      await this.persist();
      if ('actionId' in msg) {
        await this.recordProcessedAction(msg.actionId, event);
      }
      this.broadcast(event);
      console.log(
        `[DO:${state.roomCode}] Gameplay action=${msg.type} transport=${transport} playerId=${msg.playerId} status=ok`
      );
      return { ok: true as const, event };
    };

    switch (msg.type) {
      case 'TOGGLE_READY': {
        player.ready = !player.ready;
        state.updatedAt = Date.now();
        return finalizeSuccess({ type: 'STATE_SYNC', state });
      }

      case 'SELECT_TEAM': {
        if (state.status !== 'lobby') {
          return {
            ok: false,
            status: 409,
            code: 'GAME_ALREADY_STARTED',
            message: 'Solo se puede cambiar de equipo en la sala de espera.',
          };
        }
        const team = state.teams.find((t) => t.id === msg.teamId);
        if (!team) {
          return { ok: false, status: 400, code: 'INVALID_TEAM', message: 'Equipo inválido.' };
        }
        player.teamId = team.id;
        refreshAllTeamRoles(state);
        state.updatedAt = Date.now();
        return finalizeSuccess({ type: 'STATE_SYNC', state });
      }

      case 'ROLL_DICE': {
        const turnPrecheck = canPlayerActOnTeamTurn(state, msg.playerId);
        if (!turnPrecheck.allowed) {
          const code = turnPrecheck.errorCode ?? 'NOT_YOUR_TURN';
          console.warn(
            `[DO:${state.roomCode}] Rejected ROLL_DICE transport=${transport} playerId=${msg.playerId} code=${code} activePlayerId=${state.activePlayerId ?? 'none'}`
          );
          return {
            ok: false,
            status: code === 'PLAYER_NOT_FOUND' ? 404 : 409,
            code,
            message: turnPrecheck.reason ?? 'No es tu turno.',
            includeState: true,
          };
        }
        const questions = await db.getQuestions();
        const rollRes = rollDiceServerSide(state, msg.playerId, questions);
        if (!rollRes.ok || !rollRes.roll) {
          const code = rollRes.errorCode ?? 'INVALID_ROLL';
          const status =
            code === 'PLAYER_NOT_FOUND'
              ? 404
              : code === 'NOT_YOUR_TURN' || code === 'INVALID_PHASE' || code === 'ROOM_NOT_PLAYING'
              ? 409
              : 403;
          console.warn(
            `[DO:${state.roomCode}] Rejected ROLL_DICE transport=${transport} playerId=${msg.playerId} code=${code}`
          );
          return {
            ok: false,
            status,
            code,
            message: rollRes.error ?? 'Acción de dados no permitida.',
            includeState: true,
          };
        }
        return finalizeSuccess({
          type: 'DICE_ROLLED',
          roll: rollRes.roll,
          state,
        });
      }

      case 'SUBMIT_ANSWER': {
        const ansRes = submitAnswerServerSide(
          state,
          msg.playerId,
          msg.selectedIndices,
          msg.collaborated ?? true
        );
        if (!ansRes.ok) {
          const code = ansRes.errorCode ?? 'INVALID_ANSWER';
          const status = code === 'PLAYER_NOT_FOUND' ? 404 : code === 'NOT_YOUR_TURN' ? 409 : 400;
          return {
            ok: false,
            status,
            code,
            message: ansRes.error ?? 'No se pudo procesar la respuesta.',
            includeState: code === 'NOT_YOUR_TURN',
          };
        }
        if (state.status === 'finished') {
          await db.saveMatchHistory(buildMatchHistoryFromState(state));
        }
        return finalizeSuccess({
          type: 'ANSWER_RESULT',
          isCorrect: Boolean(ansRes.isCorrect),
          pointsAwarded: ansRes.pointsAwarded ?? 0,
          unlockedBadges: ansRes.unlockedBadges ?? [],
          state,
        });
      }

      case 'COMPLETE_CHALLENGE_3D': {
        const chRes = completeChallenge3DServerSide(
          state,
          msg.playerId,
          msg.selectedHotspotIds
        );
        if (!chRes.ok) {
          const code = chRes.errorCode ?? 'INVALID_CHALLENGE';
          const status = code === 'PLAYER_NOT_FOUND' ? 404 : code === 'NOT_YOUR_TURN' ? 409 : 400;
          return {
            ok: false,
            status,
            code,
            message: chRes.error ?? 'No se pudo completar el desafío 3D.',
            includeState: code === 'NOT_YOUR_TURN',
          };
        }
        return finalizeSuccess({
          type: 'ANSWER_RESULT',
          isCorrect: Boolean(chRes.isCorrect),
          pointsAwarded: chRes.pointsAwarded ?? 0,
          unlockedBadges: chRes.unlockedBadges ?? [],
          state,
        });
      }

      case 'NEXT_TURN': {
        const turnAuth = canPlayerActOnTeamTurn(state, msg.playerId);
        if (!turnAuth.allowed) {
          return {
            ok: false,
            status: turnAuth.errorCode === 'PLAYER_NOT_FOUND' ? 404 : 409,
            code: turnAuth.errorCode ?? 'NOT_YOUR_TURN',
            message:
              turnAuth.reason ??
              'Solo el equipo activo puede avanzar al siguiente turno.',
            includeState: true,
          };
        }
        advanceTurnServerSide(state);
        return finalizeSuccess({ type: 'STATE_SYNC', state });
      }
    }
  }

  private async executeAuthoritativeTeacherCommand(
    state: GameRoomState,
    teacherToken: string | undefined,
    command: Extract<ClientToServerMessage, { type: 'TEACHER_ACTION' }>['command'],
    source: 'ws' | 'http',
    originWs?: WebSocket
  ): Promise<
    | { ok: true; state: GameRoomState; wasTransitionToPlaying: boolean }
    | { ok: false; code: string; status: number; message: string }
  > {
    if (
      !verifyTeacherToken(
        teacherToken,
        state.roomCode,
        this.teacherPin,
        this.env.TEACHER_TOKEN_SECRET
      )
    ) {
      console.warn(
        `[DO:${state.roomCode}] UNAUTHORIZED_TEACHER command=${command.kind} source=${source}`
      );
      return {
        ok: false,
        code: 'UNAUTHORIZED_TEACHER',
        status: 401,
        message: 'Token de docente inválido o expirado.',
      };
    }

    const prevStatus = state.status;
    const db = new DatabaseService(this.env.DB);
    const questions = await db.getQuestions();
    const cmdRes = executeTeacherCommandServerSide(state, command, questions);
    if (!cmdRes.ok) {
      return {
        ok: false,
        code: 'TEACHER_CMD_ERROR',
        status: 400,
        message: cmdRes.error ?? 'Error al ejecutar comando del docente.',
      };
    }

    if (state.status === 'finished') {
      await db.saveMatchHistory(buildMatchHistoryFromState(state));
    }

    const wasTransitionToPlaying =
      command.kind === 'START_GAME' && prevStatus !== 'playing' && state.status === 'playing';

    if (command.kind === 'CLOSE_ROOM') {
      await this.ctx.storage.put('room_closed', true);
    }

    await this.persist();

    if (command.kind === 'CLOSE_ROOM') {
      this.broadcast({
        type: 'ERROR',
        code: 'ROOM_CLOSED',
        message: 'Esta partida ha sido cerrada por el profesor.',
      });
      this.broadcast({ type: 'STATE_SYNC', state });
      for (const sock of this.getActiveSockets()) {
        if (originWs && sock === originWs) continue;
        try {
          if (typeof sock.close === 'function') sock.close(1000, 'ROOM_CLOSED');
        } catch {
          // Ignore
        }
      }
      console.log(`[DO:${state.roomCode}] ROOM_CLOSED source=${source}`);
    } else if (command.kind === 'START_GAME') {
      const startedAt = state.startedAt ?? Date.now();
      if (wasTransitionToPlaying) {
        const deliveredStart = this.broadcast({
          type: 'GAME_STARTED',
          roomCode: state.roomCode,
          startedAt,
          state,
        });
        const deliveredSync = this.broadcast({ type: 'STATE_SYNC', state });
        console.log(
          `[DO:${state.roomCode}] GAME_STARTED source=${source} startedAt=${startedAt} players=${state.players.length} deliveredStart=${deliveredStart} deliveredSync=${deliveredSync}`
        );
      } else if (originWs) {
        this.sendToSocket(originWs, {
          type: 'GAME_STARTED',
          roomCode: state.roomCode,
          startedAt,
          state,
        });
        this.sendToSocket(originWs, { type: 'STATE_SYNC', state });
      }
    } else {
      const delivered = this.broadcast({ type: 'STATE_SYNC', state });
      console.log(
        `[DO:${state.roomCode}] TEACHER_ACTION kind=${command.kind} source=${source} status=${state.status} delivered=${delivered}`
      );
    }

    return { ok: true, state, wasTransitionToPlaying };
  }

  private sendToSocket(ws: WebSocket, message: ServerToClientMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Socket closed
    }
  }

  private broadcast(message: ServerToClientMessage, exclude?: WebSocket): number {
    const payload = JSON.stringify(message);
    const sockets =
      typeof this.ctx.getWebSockets === 'function'
        ? this.ctx.getWebSockets()
        : Array.from(this.socketPlayers.keys());

    let delivered = 0;
    for (const sock of sockets) {
      if (sock === exclude) continue;
      try {
        sock.send(payload);
        delivered++;
      } catch {
        // Ignore disconnected socket
      }
    }
    return delivered;
  }
}
