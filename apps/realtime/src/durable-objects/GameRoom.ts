import {
  ClientMessageSchema,
  ClientToServerMessage,
  GameConfig,
  GameRoomState,
  ServerToClientMessage,
  TeacherCommandSchema,
  buildMatchHistoryFromState,
  advanceTurnServerSide,
  completeChallenge3DServerSide,
  createInitialRoomState,
  disconnectPlayerFromState,
  executeTeacherCommandServerSide,
  joinPlayerToState,
  normalizeRoomCode,
  refreshAllTeamRoles,
  rollDiceServerSide,
  submitAnswerServerSide,
} from '@prl-oca/shared';
import {
  RateLimiter,
  buildCorsHeaders,
  createTeacherToken,
  isOriginAllowed,
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
}

interface SocketAttachment {
  playerId: string;
  isTeacher?: boolean;
  isSpectator?: boolean;
}

/**
 * Durable Object `GameRoom`
 * Manages the authoritative state of a single PRL-OCA 3D match room (up to 15 players + teacher + spectators)
 * using Cloudflare Durable Objects WebSocket Hibernation API.
 */
export class GameRoom {
  private stateData: GameRoomState | null = null;
  private teacherPin: string = crypto.randomUUID();
  private processedActionIds = new Set<string>();
  private rateLimiter = new RateLimiter(45, 5000);
  private socketPlayers = new Map<WebSocket, SocketAttachment>();

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env
  ) {}

  private async ensureLoaded(roomCodeFallback = 'PRL001'): Promise<GameRoomState> {
    if (this.stateData) return this.stateData;
    const stored = await this.ctx.storage.get<GameRoomState>('room_state');
    const storedPin = await this.ctx.storage.get<string>('teacher_pin');
    const storedCode = await this.ctx.storage.get<string>('room_code');
    if (storedPin) this.teacherPin = storedPin;

    const fallbackCode = normalizeRoomCode(storedCode ?? roomCodeFallback) || 'PRL001';
    if (stored) {
      this.stateData = stored;
    } else {
      this.stateData = createInitialRoomState(fallbackCode);
      await this.ctx.storage.put('room_code', fallbackCode);
      await this.ctx.storage.put('room_state', this.stateData);
    }
    return this.stateData;
  }

  private async hasPersistedRoom(): Promise<boolean> {
    if (this.stateData) return true;
    const stored = await this.ctx.storage.get<GameRoomState>('room_state');
    if (stored) {
      this.stateData = stored;
      const storedPin = await this.ctx.storage.get<string>('teacher_pin');
      if (storedPin) this.teacherPin = storedPin;
      return true;
    }
    return false;
  }

  private async persist(): Promise<void> {
    if (this.stateData) {
      await this.ctx.storage.put('room_code', this.stateData.roomCode);
      await this.ctx.storage.put('room_state', this.stateData);
    }
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

    const roomCode = normalizeRoomCode(url.searchParams.get('roomCode') ?? 'PRL001') || 'PRL001';

    // Initialize / Configure Room via POST /init
    if (request.method === 'POST' && url.pathname.endsWith('/init')) {
      const body = (await request.json().catch(() => ({}))) as {
        roomCode?: string;
        config?: Partial<GameConfig>;
        teacherPin?: string;
      };
      const code = normalizeRoomCode(body.roomCode ?? roomCode) || roomCode;
      this.teacherPin = body.teacherPin?.trim() || crypto.randomUUID().slice(0, 8);
      this.stateData = createInitialRoomState(code, body.config);
      await this.ctx.storage.put('room_initialized', true);
      await this.ctx.storage.put('room_code', code);
      await this.ctx.storage.put('teacher_pin', this.teacherPin);
      await this.persist();
      const teacherToken = createTeacherToken(
        code,
        this.teacherPin,
        this.env.TEACHER_TOKEN_SECRET
      );
      console.log(`[DO:${code}] Room initialized (maxPlayers=${this.stateData.config.maxPlayers})`);
      return new Response(
        JSON.stringify({
          ok: true,
          roomCode: code,
          teacherToken,
          state: this.stateData,
        }),
        {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }
      );
    }

    // Read Room State via GET /state
    if (request.method === 'GET' && url.pathname.endsWith('/state')) {
      const exists = await this.hasPersistedRoom();
      if (!exists || !this.stateData) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Sala no encontrada o aún no iniciada.' }),
          {
            status: 404,
            headers: { ...cors, 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response(JSON.stringify({ ok: true, state: this.stateData }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // HTTP Authoritative fallback for Teacher Actions -> POST /teacher-action
    if (request.method === 'POST' && url.pathname.endsWith('/teacher-action')) {
      const exists = await this.hasPersistedRoom();
      if (!exists || !this.stateData) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Sala no encontrada para ejecutar acción docente.' }),
          {
            status: 404,
            headers: { ...cors, 'Content-Type': 'application/json' },
          }
        );
      }
      const rawBody = (await request.json().catch(() => ({}))) as {
        teacherToken?: string;
        command?: unknown;
      };
      const headerToken = request.headers.get('X-Teacher-Token')?.trim();
      const token = rawBody.teacherToken?.trim() || headerToken;
      const parsedCmd = TeacherCommandSchema.safeParse(rawBody.command);
      if (!parsedCmd.success) {
        return new Response(
          JSON.stringify({ ok: false, code: 'INVALID_COMMAND', error: 'Comando docente inválido.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
      const cmdResult = await this.executeAuthoritativeTeacherCommand(
        this.stateData,
        token,
        parsedCmd.data,
        'http'
      );
      if (!cmdResult.ok) {
        return new Response(
          JSON.stringify({ ok: false, code: cmdResult.code, error: cmdResult.message }),
          { status: cmdResult.status, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          gameStarted: cmdResult.state.status === 'playing',
          startedAt: cmdResult.state.startedAt,
          state: cmdResult.state,
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const state = await this.ensureLoaded(roomCode);

    // WebSocket Upgrade for Real-Time Multiplayer
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      if (
        !isOriginAllowed(
          requestOrigin,
          this.env.ALLOWED_ORIGIN ?? '*',
          this.env.ENVIRONMENT ?? 'development'
        )
      ) {
        return new Response(JSON.stringify({ ok: false, error: 'Origen WebSocket no autorizado.' }), {
          status: 403,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
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

    return new Response(JSON.stringify({ ok: false, error: 'Ruta no encontrada en GameRoom' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  public async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    const state = await this.ensureLoaded();
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

    // Deduplicate actions
    if ('actionId' in msg) {
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
    const state = await this.ensureLoaded();
    const att = this.getSocketAttachment(ws);
    this.socketPlayers.delete(ws);
    if (typeof ws.serializeAttachment === 'function') {
      try {
        ws.serializeAttachment({ playerId: '' });
      } catch {
        // Socket already closed
      }
    }

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

  public async handleValidatedMessage(
    ws: WebSocket,
    state: GameRoomState,
    msg: Exclude<ClientToServerMessage, { type: 'PING' }>
  ): Promise<void> {
    const db = new DatabaseService(this.env.DB);

    switch (msg.type) {
      case 'JOIN_ROOM': {
        let verifiedTeacher = false;
        let issuedToken: string | undefined;
        if (msg.isTeacher) {
          if (msg.teacherPin === this.teacherPin) {
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

        const joinRes = joinPlayerToState(state, {
          playerId: msg.playerId,
          playerName: msg.playerName,
          preferredTeamId: msg.preferredTeamId,
          isTeacher: verifiedTeacher,
          isSpectator: msg.isSpectator,
        });

        if (!joinRes.ok) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: 'JOIN_REJECTED',
            message: joinRes.error ?? 'No se pudo unir a la sala.',
          });
          return;
        }

        const resolvedPlayerId = joinRes.player?.id ?? msg.playerId;

        // Transfer ownership cleanly away from any previous dead/stale sockets for this player
        for (const otherWs of this.getActiveSockets()) {
          if (otherWs === ws) continue;
          const otherAtt = this.getSocketAttachment(otherWs);
          if (otherAtt?.playerId === resolvedPlayerId) {
            this.socketPlayers.delete(otherWs);
            if (typeof otherWs.serializeAttachment === 'function') {
              try {
                otherWs.serializeAttachment({ playerId: '' });
              } catch {
                // Ignore
              }
            }
          }
        }

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
        });
        this.broadcast({ type: 'STATE_SYNC', state }, ws);
        console.log(
          `[DO:${state.roomCode}] JOIN_ROOM playerId=${resolvedPlayerId} isTeacher=${verifiedTeacher} status=${state.status} sockets=${this.getActiveSockets().length}`
        );
        break;
      }

      case 'TOGGLE_READY': {
        const p = state.players.find((pl) => pl.id === msg.playerId);
        if (p) {
          p.ready = !p.ready;
          state.updatedAt = Date.now();
          await this.persist();
          this.broadcast({ type: 'STATE_SYNC', state });
        }
        break;
      }

      case 'SELECT_TEAM': {
        if (state.status !== 'lobby') {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: 'GAME_ALREADY_STARTED',
            message: 'Solo se puede cambiar de equipo en la sala de espera.',
          });
          return;
        }
        const player = state.players.find((pl) => pl.id === msg.playerId);
        const team = state.teams.find((t) => t.id === msg.teamId);
        if (player && team) {
          player.teamId = team.id;
          refreshAllTeamRoles(state);
          state.updatedAt = Date.now();
          await this.persist();
          this.broadcast({ type: 'STATE_SYNC', state });
        }
        break;
      }

      case 'ROLL_DICE': {
        const questions = await db.getQuestions();
        const rollRes = rollDiceServerSide(state, msg.playerId, questions);
        if (!rollRes.ok || !rollRes.roll) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: 'INVALID_ROLL',
            message: rollRes.error ?? 'Acción de dados no permitida.',
          });
          return;
        }
        await this.persist();
        this.broadcast({
          type: 'DICE_ROLLED',
          roll: rollRes.roll,
          state,
        });
        break;
      }

      case 'SUBMIT_ANSWER': {
        const ansRes = submitAnswerServerSide(
          state,
          msg.playerId,
          msg.selectedIndices,
          msg.collaborated ?? true
        );
        if (!ansRes.ok) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: 'INVALID_ANSWER',
            message: ansRes.error ?? 'No se pudo procesar la respuesta.',
          });
          return;
        }
        if (state.status === 'finished') {
          await db.saveMatchHistory(buildMatchHistoryFromState(state));
        }
        await this.persist();
        this.broadcast({
          type: 'ANSWER_RESULT',
          isCorrect: Boolean(ansRes.isCorrect),
          pointsAwarded: ansRes.pointsAwarded ?? 0,
          unlockedBadges: ansRes.unlockedBadges ?? [],
          state,
        });
        break;
      }

      case 'COMPLETE_CHALLENGE_3D': {
        const chRes = completeChallenge3DServerSide(
          state,
          msg.playerId,
          msg.selectedHotspotIds
        );
        if (!chRes.ok) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: 'INVALID_CHALLENGE',
            message: chRes.error ?? 'No se pudo completar el desafío 3D.',
          });
          return;
        }
        await this.persist();
        this.broadcast({
          type: 'ANSWER_RESULT',
          isCorrect: Boolean(chRes.isCorrect),
          pointsAwarded: chRes.pointsAwarded ?? 0,
          unlockedBadges: chRes.unlockedBadges ?? [],
          state,
        });
        break;
      }

      case 'NEXT_TURN': {
        const activeTeam = state.teams[state.activeTeamIndex];
        const player = state.players.find((p) => p.id === msg.playerId);
        if (!player || (!player.isTeacher && player.teamId !== activeTeam?.id)) {
          this.sendToSocket(ws, {
            type: 'ERROR',
            code: 'UNAUTHORIZED_TURN',
            message: 'Solo el equipo activo o el docente pueden avanzar al siguiente turno.',
          });
          return;
        }
        advanceTurnServerSide(state);
        await this.persist();
        this.broadcast({ type: 'STATE_SYNC', state });
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

    await this.persist();

    if (command.kind === 'START_GAME') {
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
