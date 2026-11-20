import { create } from 'zustand';
import {
  CameraViewMode,
  ClientToServerMessage,
  GameConfig,
  GameRoomState,
  GraphicsQuality,
  INITIAL_QUESTION_BANK,
  MatchHistoryRecord,
  QuestionItem,
  ServerToClientMessage,
  advanceTurnServerSide,
  buildMatchHistoryFromState,
  completeChallenge3DServerSide,
  createInitialRoomState,
  disconnectPlayerFromState,
  executeTeacherCommandServerSide,
  getRoomParticipantStats,
  isValidRoomCodeFormat,
  joinPlayerToState,
  normalizeRoomCode,
  refreshAllTeamRoles,
  rollDiceServerSide,
  submitAnswerServerSide,
} from '@prl-oca/shared';
import { ConnectionState, mpClient } from '../multiplayer/wsClient';
import { soundEngine } from '../audio/SoundEngine';
import { enterGameLandscapeMode, exitGameLandscapeMode } from '../utils/mobileOrientation';
import {
  diagnoseFetchConnectionFailure,
  formatServerHttpDiagnostic,
  hasConfiguredApiEnv,
  isLocalFallbackEnabled,
  isProductionEnvironment,
  resolveApiBaseUrl,
} from '../utils/networkConfig';

export type AppScreen =
  | 'home'
  | 'create_join'
  | 'lobby'
  | 'game'
  | 'victory'
  | 'history'
  | 'question_editor';

const QUESTIONS_STORAGE_KEY = 'prl_oca_custom_questions_v1';
const HISTORY_STORAGE_KEY = 'prl_oca_match_history_v1';
const PREFS_STORAGE_KEY = 'prl_oca_visual_prefs_v1';

let walkFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let arrivalRevealTimer: ReturnType<typeof setTimeout> | null = null;

function clearMovementTimers(): void {
  if (walkFallbackTimer) {
    clearTimeout(walkFallbackTimer);
    walkFallbackTimer = null;
  }
  if (arrivalRevealTimer) {
    clearTimeout(arrivalRevealTimer);
    arrivalRevealTimer = null;
  }
}

function detectDefaultGraphicsQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'alta';
  const isMobile =
    window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (isMobile) {
    return cores >= 6 ? 'media' : 'baja';
  }
  return cores >= 8 ? 'alta' : 'media';
}

function loadStoredQuestions(): QuestionItem[] {
  if (typeof window === 'undefined') return [...INITIAL_QUESTION_BANK];
  try {
    const raw = window.localStorage.getItem(QUESTIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuestionItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback
  }
  return [...INITIAL_QUESTION_BANK];
}

function loadStoredHistory(): MatchHistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MatchHistoryRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fallback
  }
  return [];
}

const PLAYER_ID_STORAGE_KEY = 'prl_oca_player_id';

function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'player_local';
  const existing = window.sessionStorage.getItem(PLAYER_ID_STORAGE_KEY);
  if (existing) return existing;
  const created = `plr_${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, created);
  return created;
}

function persistSessionPlayerIdentity(playerId: string, playerName?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
    if (playerName?.trim()) {
      window.sessionStorage.setItem('prl_oca_player_name', playerName.trim());
    }
  } catch {
    // Ignore storage restriction
  }
}

function persistSessionPlayerToken(roomCode: string, token?: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    window.sessionStorage.setItem(
      `prl_oca_player_token_${normalizeRoomCode(roomCode)}`,
      token
    );
  } catch {
    // Ignore storage restriction
  }
}

function loadSessionPlayerToken(roomCode: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return (
      window.sessionStorage.getItem(`prl_oca_player_token_${normalizeRoomCode(roomCode)}`) ??
      undefined
    );
  } catch {
    return undefined;
  }
}

const FATAL_JOIN_ERRORS = new Set([
  'ROOM_NOT_FOUND',
  'ROOM_CLOSED',
  'ROOM_FINISHED',
  'ROOM_FULL',
  'INVALID_ROOM_CODE',
  'ROOM_NOT_JOINABLE',
  'INVALID_TEACHER_PIN',
  'INVALID_PLAYER_TOKEN',
  'JOIN_REJECTED',
]);

function mapRoomErrorMessage(code?: string, serverMessage?: string): string {
  switch (code) {
    case 'ROOM_NOT_FOUND':
      return serverMessage || 'No existe ninguna partida con ese código.';
    case 'ROOM_CLOSED':
      return serverMessage || 'Esta partida ha sido cerrada por el profesor.';
    case 'ROOM_FINISHED':
      return serverMessage || 'La partida ya ha finalizado y no admite incorporaciones.';
    case 'ROOM_FULL':
      return serverMessage || 'La sala está llena y ha alcanzado su capacidad máxima.';
    case 'INVALID_ROOM_CODE':
      return serverMessage || 'Formato de código de sala incorrecto.';
    case 'ROOM_NOT_JOINABLE':
      return (
        serverMessage ||
        'La partida ya está en curso y no admite nuevas incorporaciones en este momento.'
      );
    case 'INVALID_TEACHER_PIN':
      return serverMessage || 'La clave/PIN del profesor no coincide.';
    case 'INVALID_PLAYER_TOKEN':
      return (
        serverMessage ||
        'Credencial de participante inválida o caducada (INVALID_PLAYER_TOKEN).'
      );
    case 'UNAUTHORIZED_PLAYER':
      return (
        serverMessage ||
        'Acción no autorizada para tu identidad de sesión (UNAUTHORIZED_PLAYER).'
      );
    case 'PLAYER_NOT_FOUND':
      return serverMessage || 'Jugador no reconocido en la sala (PLAYER_NOT_FOUND).';
    case 'NOT_YOUR_TURN':
      return serverMessage || 'No es tu turno en este momento (NOT_YOUR_TURN).';
    case 'DURABLE_OBJECT_ERROR':
    case 'DURABLE_OBJECT_BINDING_MISSING':
      return (
        serverMessage ||
        'Error en el servicio Durable Objects de Cloudflare Workers (DURABLE_OBJECT_ERROR).'
      );
    default:
      return serverMessage || 'No fue posible conectar con la sala solicitada.';
  }
}

export interface GameStore {
  screen: AppScreen;
  createJoinTab: 'create' | 'join';
  connectionStatus: ConnectionState;
  isRemoteSession: boolean;
  roomState: GameRoomState | null;
  playerId: string;
  playerName: string;
  playerToken: string;
  isTeacher: boolean;
  isSpectator: boolean;
  projectorMode: boolean;
  teacherPin: string;
  teacherToken: string;
  errorMessage: string | null;
  captionToast: string | null;

  // Camera & Visuals
  cameraView: CameraViewMode;
  cameraResetKey: number;
  cameraZoomDelta: number;
  graphicsQuality: GraphicsQuality;
  board2DMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  isRollingAnimation: boolean;
  isTokenMoving: boolean;
  challengeModalReady: boolean;

  // Modals
  showQRModal: boolean;
  showTeacherPanel: boolean;
  showSettingsModal: boolean;
  showInstructionsModal: boolean;

  // Course Content & History
  questionBank: QuestionItem[];
  matchHistory: MatchHistoryRecord[];

  // Navigation & UI Actions
  setScreen: (screen: AppScreen) => void;
  setCreateJoinTab: (tab: 'create' | 'join') => void;
  setCameraView: (view: CameraViewMode) => void;
  resetCamera: () => void;
  zoomCamera: (delta: number) => void;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  setBoard2DMode: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setProjectorMode: (enabled: boolean) => void;
  setShowQRModal: (show: boolean) => void;
  setShowTeacherPanel: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setShowInstructionsModal: (show: boolean) => void;
  setCaptionToast: (text: string | null) => void;
  clearError: () => void;
  notifyTokenArrived: () => void;

  // Match Lifecycle Actions
  createRoom: (params: {
    teacherName: string;
    teacherPin: string;
    config: Partial<GameConfig>;
  }) => Promise<void>;
  joinRoom: (params: {
    roomCode: string;
    playerName: string;
    preferredTeamId?: string;
    isTeacher?: boolean;
    isSpectator?: boolean;
    teacherPin?: string;
  }) => Promise<void>;
  startIndividualGame: (playerName: string) => void;
  populate15DemoPlayers: () => void;
  markLocalDisconnect: () => void;
  leaveRoom: () => void;
  closeRoom: () => Promise<void>;
  applyServerMessage: (msg: ServerToClientMessage) => void;
  syncRoomFromServer: () => Promise<void>;

  // Gameplay Actions
  selectTeamInLobby: (teamId: string) => void;
  toggleReadyInLobby: () => void;
  rollDice: () => void;
  submitAnswer: (selectedIndices: number[], collaborated?: boolean) => void;
  completeChallenge3D: (selectedHotspotIds: string[]) => void;
  nextTurn: () => void;
  runTeacherCommand: (command: {
    kind: string;
    playerId?: string;
    teamId?: string;
    newName?: string;
    targetTile?: number;
    delta?: number;
    questionId?: string;
    challengeId?: string;
    partialConfig?: Partial<GameConfig>;
  }) => Promise<void> | void;

  // Question Bank CRUD
  saveQuestion: (item: QuestionItem) => void;
  deleteQuestion: (id: string) => void;
  duplicateQuestion: (id: string) => void;
  toggleQuestionActive: (id: string) => void;
  importQuestions: (items: QuestionItem[]) => void;
  resetQuestionBank: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const inFlightSlotActions = new Set<string>();
  const pendingSlotActionIds = new Map<string, string>();

  const getOrCreateIdempotentActionId = (slotKey: string, prefix: string): string => {
    const existing = pendingSlotActionIds.get(slotKey);
    if (existing) return existing;
    const created = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    pendingSlotActionIds.set(slotKey, created);
    return created;
  };

  type GameplayClientMsg = Extract<
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
  >;

  const sendRemoteGameplayAction = async (params: {
    roomCode: string;
    slotKey: string;
    actionLabel: string;
    msg: GameplayClientMsg;
    onFailureReset?: () => void;
  }): Promise<boolean> => {
    const { roomCode, slotKey, actionLabel, msg, onFailureReset } = params;
    if (inFlightSlotActions.has(slotKey)) {
      console.warn('[PRL-OCA][Action] Ignorada doble pulsación con operación en curso', {
        type: msg.type,
        roomCode,
        actionId: msg.actionId,
      });
      return true;
    }

    const apiBase = resolveApiBaseUrl();
    const pToken = msg.playerToken || loadSessionPlayerToken(roomCode);
    if (!apiBase || !pToken) {
      mpClient.forceReconnectIfNeeded();
      onFailureReset?.();
      set({
        errorMessage: !apiBase
          ? 'Endpoint de Cloudflare Workers no configurado (VITE_API_URL).'
          : 'Credenciales de participante (playerToken) no disponibles. Reconecta con la sala e inténtalo de nuevo.',
      });
      return false;
    }

    inFlightSlotActions.add(slotKey);
    const targetUrl = `${apiBase}/api/rooms/${normalizeRoomCode(roomCode)}/action`;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Player-Token': pToken,
          'X-Player-Id': msg.playerId,
        },
        body: JSON.stringify({
          playerId: msg.playerId,
          playerToken: pToken,
          message: { ...msg, playerToken: pToken },
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutTimer);

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
        deduplicated?: boolean;
        event?: ServerToClientMessage;
      } | null;

      if (res.ok && data?.ok && data.event) {
        pendingSlotActionIds.delete(slotKey);
        console.info('[PRL-OCA][HTTP][Action] OK', {
          type: msg.type,
          roomCode: normalizeRoomCode(roomCode),
          playerId: msg.playerId,
          actionId: msg.actionId,
          status: res.status,
          deduplicated: Boolean(data.deduplicated),
          elapsedMs: Date.now() - startedAt,
        });
        handleServerMessage(data.event);
        return true;
      }

      // Deterministic server rejection (4xx/5xx): clear pending slot on 4xx so next valid turn works cleanly
      if (res.status >= 400 && res.status < 500) {
        pendingSlotActionIds.delete(slotKey);
      }
      onFailureReset?.();
      const diagnostic = formatServerHttpDiagnostic({
        status: res.status,
        errorCode: data?.error,
        serverMessage: data?.message ?? data?.error ?? `No se pudo ${actionLabel}.`,
        targetUrl,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      set({ errorMessage: diagnostic });
      return false;
    } catch (err) {
      clearTimeout(timeoutTimer);
      onFailureReset?.();
      const diagnostic = await diagnoseFetchConnectionFailure({
        error: err,
        apiBase,
        targetUrl,
        actionLabel,
      });
      set({ errorMessage: diagnostic });
      return false;
    } finally {
      inFlightSlotActions.delete(slotKey);
    }
  };

  const revealChallengeAfterArrival = () => {
    const st = get().roomState;
    const activeTeam = st?.teams[st.activeTeamIndex];
    const isBotTurn = Boolean(
      st &&
        activeTeam &&
        st.players.some((p) => p.id === 'bot_companero' && p.teamId === activeTeam.id)
    );

    if (st && isBotTurn) {
      // Automatically resolve AI bot turn without blocking the human player with a modal
      if (st.activeChallenge && !st.activeChallenge.answered) {
        if (st.activeChallenge.kind === 'question' && st.activeChallenge.question) {
          submitAnswerServerSide(
            st,
            'bot_companero',
            st.activeChallenge.question.correctIndices,
            false
          );
        } else if (
          st.activeChallenge.kind === 'challenge3d' &&
          st.activeChallenge.challenge3d
        ) {
          const correctIds = st.activeChallenge.challenge3d.hotspots
            .filter((h) => h.isCorrect)
            .map((h) => h.id);
          completeChallenge3DServerSide(st, 'bot_companero', correctIds);
        }
      }
      soundEngine.playSfx('reward');
      set({
        roomState: { ...st },
        isTokenMoving: false,
        challengeModalReady: false,
      });
      setTimeout(() => {
        const cur = get().roomState;
        if (!cur || cur.status === 'finished') {
          if (cur?.status === 'finished') {
            set({ screen: 'victory', challengeModalReady: true });
          }
          return;
        }
        advanceTurnServerSide(cur);
        set((s) => ({
          roomState: { ...cur },
          cameraView: 'isometric',
          cameraResetKey: s.cameraResetKey + 1,
          isTokenMoving: false,
          challengeModalReady: true,
        }));
      }, 1100);
      return;
    }

    if (st && st.activeChallenge && !st.activeChallenge.answered) {
      const now = Date.now();
      const durationSec =
        st.activeChallenge.kind === 'question'
          ? st.activeChallenge.question?.timeSeconds ?? 45
          : st.activeChallenge.challenge3d?.timeSeconds ?? 90;
      st.activeChallenge.startedAt = now;
      st.activeChallenge.expiresAt = now + durationSec * 1000;
      soundEngine.playMusic(
        st.activeChallenge.kind === 'challenge3d' ? 'emergency' : 'suspense'
      );
      set({
        roomState: { ...st },
        isTokenMoving: false,
        challengeModalReady: true,
      });
    } else {
      set({
        isTokenMoving: false,
        challengeModalReady: true,
      });
    }
  };

  const scheduleMovementSequence = (stateAfterRoll: GameRoomState) => {
    clearMovementTimers();
    const roll = stateAfterRoll.lastDiceRoll;
    const finalPos =
      stateAfterRoll.teams[stateAfterRoll.activeTeamIndex]?.position ??
      roll?.toTile ??
      1;
    const startPos = roll?.fromTile ?? 1;
    const stepsCount = Math.max(1, Math.abs(finalPos - startPos));

    // Pause briefly on dice result (750ms) then switch camera to follow active token
    setTimeout(() => {
      if (get().screen === 'game') {
        set({ cameraView: 'active_tile' });
      }
    }, 750);

    // Fallback timer in case 2D mode is active or WebGL frame callback doesn't fire
    const estimatedWalkMs = get().reducedMotion
      ? 900
      : stepsCount * 560 + 1400;
    walkFallbackTimer = setTimeout(() => {
      if (get().isTokenMoving || !get().challengeModalReady) {
        revealChallengeAfterArrival();
      }
    }, estimatedWalkMs);
  };

  const persistFinishedMatchHistory = (finishedState: GameRoomState) => {
    if (finishedState.status !== 'finished') return;
    const existing = get().matchHistory;
    const alreadySaved = existing.some(
      (m) =>
        m.roomCode === finishedState.roomCode &&
        Math.abs(m.finishedAt - finishedState.updatedAt) < 10000
    );
    if (alreadySaved) return;
    const record = buildMatchHistoryFromState(finishedState);
    const updatedHistory = [record, ...existing].slice(0, 50);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    }
    set({ matchHistory: updatedHistory });
  };

  const deriveScreenFromRoomState = (room: GameRoomState): AppScreen => {
    if (room.status === 'finished') return 'victory';
    if (room.status === 'playing' || room.status === 'paused') return 'game';
    return 'lobby';
  };

  const handleServerMessage = (msg: ServerToClientMessage) => {
    if (msg.type === 'GAME_STARTED') {
      const currentCode = normalizeRoomCode(get().roomState?.roomCode ?? '');
      const incomingCode = normalizeRoomCode(msg.roomCode || msg.state.roomCode);
      if (currentCode && incomingCode && currentCode !== incomingCode) {
        console.warn(
          `[PRL-OCA][Sync] Ignoring GAME_STARTED for another room (${incomingCode} != ${currentCode})`
        );
        return;
      }

      const prevStatus = get().roomState?.status;
      clearMovementTimers();
      console.info(
        `[PRL-OCA][Sync] GAME_STARTED handled for room=${incomingCode} startedAt=${msg.startedAt} turn=${msg.state.turnNumber}`
      );

      if (prevStatus !== 'playing') {
        soundEngine.playSfx('challenge_start');
        soundEngine.playMusic('board');
      }

      set({
        roomState: { ...msg.state },
        screen: deriveScreenFromRoomState(msg.state),
        errorMessage: null,
        isRollingAnimation: false,
        isTokenMoving: false,
        challengeModalReady: true,
      });
      void enterGameLandscapeMode();
      return;
    }

    if (msg.type === 'STATE_SYNC') {
      const currentCode = normalizeRoomCode(get().roomState?.roomCode ?? '');
      const incomingCode = normalizeRoomCode(msg.state.roomCode);
      if (currentCode && incomingCode && currentCode !== incomingCode) {
        return;
      }

      const prevStatus = get().roomState?.status;
      const prevRollTs = get().roomState?.lastDiceRoll?.timestamp ?? 0;
      const incomingRollTs = msg.state.lastDiceRoll?.timestamp ?? 0;
      const hasNewRollFromSync =
        incomingRollTs > prevRollTs && msg.state.phase === 'answering';

      const nextScreen = deriveScreenFromRoomState(msg.state);
      const startedFromLobby = prevStatus === 'lobby' && msg.state.status === 'playing';

      if (startedFromLobby) {
        clearMovementTimers();
        soundEngine.playSfx('challenge_start');
        soundEngine.playMusic('board');
      } else if (msg.state.status === 'finished') {
        soundEngine.playSfx('victory_fanfare');
        soundEngine.playMusic('victory');
        persistFinishedMatchHistory(msg.state);
      } else if (hasNewRollFromSync) {
        soundEngine.playSfx('dice_hit');
      }

      const nextPlayerId = msg.yourPlayerId ?? get().playerId;
      const nextPlayerToken = msg.playerToken ?? get().playerToken;
      const nextTeacherToken = msg.teacherToken ?? get().teacherToken;

      if (msg.yourPlayerId) {
        persistSessionPlayerIdentity(msg.yourPlayerId);
      }
      if (nextPlayerId && (msg.yourPlayerId || msg.playerToken || msg.teacherToken)) {
        mpClient.updateJoinPlayerId(
          nextPlayerId,
          nextPlayerToken ?? undefined,
          nextTeacherToken ?? undefined
        );
      }
      if (msg.playerToken && msg.state.roomCode) {
        persistSessionPlayerToken(msg.state.roomCode, msg.playerToken);
      }

      set({
        roomState: { ...msg.state },
        playerId: nextPlayerId,
        playerToken: nextPlayerToken,
        teacherToken: nextTeacherToken,
        screen: nextScreen,
        errorMessage: null,
      });
      if (nextScreen === 'game') {
        void enterGameLandscapeMode();
      }
    } else if (msg.type === 'DICE_ROLLED') {
      const latestRoom = get().roomState;
      const rollSlotKey = latestRoom
        ? `${normalizeRoomCode(latestRoom.roomCode)}:${latestRoom.turnNumber}:waiting_roll:ROLL_DICE`
        : '';
      if (rollSlotKey) {
        pendingSlotActionIds.delete(rollSlotKey);
      }
      // Prevent double animation if the same roll arrives over both WS broadcast and HTTP response
      if (
        latestRoom?.lastDiceRoll?.timestamp &&
        latestRoom.lastDiceRoll.timestamp === msg.roll.timestamp &&
        get().isTokenMoving
      ) {
        set({ roomState: msg.state, isRollingAnimation: false });
        return;
      }
      soundEngine.playSfx('dice_hit');
      set({
        roomState: msg.state,
        isRollingAnimation: false,
        isTokenMoving: true,
        challengeModalReady: false,
      });
      scheduleMovementSequence(msg.state);
    } else if (msg.type === 'ANSWER_RESULT') {
      soundEngine.playSfx(msg.isCorrect ? 'answer_correct' : 'answer_wrong');
      if (msg.unlockedBadges.length > 0) {
        setTimeout(() => soundEngine.playSfx('badge_unlock'), 350);
      }
      if (msg.state.status === 'finished') {
        soundEngine.playSfx('victory_fanfare');
        soundEngine.playMusic('victory');
        persistFinishedMatchHistory(msg.state);
      }
      set({
        roomState: msg.state,
        screen: msg.state.status === 'finished' ? 'victory' : 'game',
        isTokenMoving: false,
        challengeModalReady: true,
      });
    } else if (msg.type === 'ERROR') {
      const formattedErr = mapRoomErrorMessage(msg.code, msg.message);
      const roomCodeNow = get().roomState?.roomCode;
      if (roomCodeNow) {
        const turnNow = get().roomState?.turnNumber ?? 1;
        pendingSlotActionIds.delete(`${normalizeRoomCode(roomCodeNow)}:${turnNow}:waiting_roll:ROLL_DICE`);
      }
      console.error('[PRL-OCA][WS][ERROR]', { code: msg.code, message: msg.message });
      const shouldLeaveToJoin =
        FATAL_JOIN_ERRORS.has(msg.code ?? '') &&
        (get().screen !== 'game' ||
          msg.code === 'ROOM_NOT_FOUND' ||
          msg.code === 'ROOM_CLOSED' ||
          msg.code === 'ROOM_FINISHED');
      if (shouldLeaveToJoin) {
        clearMovementTimers();
        mpClient.disconnect();
        set({
          roomState: null,
          isRemoteSession: false,
          screen: 'create_join',
          createJoinTab: 'join',
          errorMessage: formattedErr,
          isRollingAnimation: false,
          isTokenMoving: false,
          challengeModalReady: true,
        });
        return;
      }
      set({
        errorMessage: formattedErr,
        isRollingAnimation: false,
        isTokenMoving: false,
        challengeModalReady: true,
      });
    }
  };

  return {
    screen: 'home',
    createJoinTab: 'create',
    connectionStatus: 'disconnected',
    isRemoteSession: false,
    roomState: null,
    playerId: getOrCreatePlayerId(),
    playerName: 'Participante PRL',
    playerToken: '',
    isTeacher: false,
    isSpectator: false,
    projectorMode: false,
    teacherPin: '',
    teacherToken: '',
    errorMessage: null,
    captionToast: null,

    cameraView: 'isometric',
    cameraResetKey: 0,
    cameraZoomDelta: 0,
    graphicsQuality: detectDefaultGraphicsQuality(),
    board2DMode: false,
    highContrast: false,
    reducedMotion: false,
    isRollingAnimation: false,
    isTokenMoving: false,
    challengeModalReady: true,

    showQRModal: false,
    showTeacherPanel: false,
    showSettingsModal: false,
    showInstructionsModal: false,

    questionBank: loadStoredQuestions(),
    matchHistory: loadStoredHistory(),

    setScreen: (screen) => {
      soundEngine.playSfx('button_click');
      if (screen === 'home' || screen === 'create_join' || screen === 'lobby') {
        soundEngine.playMusic('menu');
      } else if (screen === 'game') {
        soundEngine.playMusic('board');
        void enterGameLandscapeMode();
      } else if (screen === 'victory') {
        soundEngine.playMusic('victory');
      }
      set({ screen, errorMessage: null });
    },

    setCreateJoinTab: (createJoinTab) => set({ createJoinTab, errorMessage: null }),
    setCameraView: (cameraView) => {
      soundEngine.playSfx('button_click');
      set((s) => ({ cameraView, cameraResetKey: s.cameraResetKey + 1 }));
    },
    resetCamera: () => {
      soundEngine.playSfx('button_click');
      set((s) => ({
        cameraView: 'isometric',
        cameraResetKey: s.cameraResetKey + 1,
      }));
    },
    zoomCamera: (delta) => {
      soundEngine.playSfx('button_click');
      set((s) => ({
        cameraZoomDelta: delta * (Math.abs(s.cameraZoomDelta) + 1),
      }));
    },
    setGraphicsQuality: (graphicsQuality) => {
      set({ graphicsQuality });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          PREFS_STORAGE_KEY,
          JSON.stringify({
            graphicsQuality,
            board2DMode: get().board2DMode,
            highContrast: get().highContrast,
            reducedMotion: get().reducedMotion,
          })
        );
      }
    },
    setBoard2DMode: (board2DMode) => set({ board2DMode }),
    setHighContrast: (highContrast) => set({ highContrast }),
    setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    setProjectorMode: (projectorMode) =>
      set({ projectorMode, showTeacherPanel: false }),
    setShowQRModal: (showQRModal) => {
      if (showQRModal) soundEngine.playSfx('menu_open');
      set({ showQRModal });
    },
    setShowTeacherPanel: (showTeacherPanel) => {
      if (showTeacherPanel) soundEngine.playSfx('menu_open');
      set({ showTeacherPanel });
    },
    setShowSettingsModal: (showSettingsModal) => {
      if (showSettingsModal) soundEngine.playSfx('menu_open');
      set({ showSettingsModal });
    },
    setShowInstructionsModal: (showInstructionsModal) => {
      if (showInstructionsModal) soundEngine.playSfx('menu_open');
      set({ showInstructionsModal });
    },
    setCaptionToast: (captionToast) => set({ captionToast }),
    clearError: () => set({ errorMessage: null }),

    notifyTokenArrived: () => {
      if (!get().isTokenMoving) return;
      if (walkFallbackTimer) {
        clearTimeout(walkFallbackTimer);
        walkFallbackTimer = null;
      }
      if (arrivalRevealTimer) {
        clearTimeout(arrivalRevealTimer);
      }
      // Pause 850ms on the illuminated landing tile before opening the Question/Challenge card
      arrivalRevealTimer = setTimeout(() => {
        revealChallengeAfterArrival();
      }, 850);
    },

    applyServerMessage: (msg) => {
      handleServerMessage(msg);
    },

    syncRoomFromServer: async () => {
      const currentRoom = get().roomState;
      if (!currentRoom || !get().isRemoteSession) return;
      const apiBase = resolveApiBaseUrl();
      if (!apiBase) return;
      const code = normalizeRoomCode(currentRoom.roomCode);
      if (!code) return;

      try {
        const res = await fetch(`${apiBase}/api/rooms/${code}`, { cache: 'no-store' });
        if (res.status === 404 || res.status === 410) {
          const errPayload = (await res.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          handleServerMessage({
            type: 'ERROR',
            code: errPayload?.error ?? (res.status === 410 ? 'ROOM_CLOSED' : 'ROOM_NOT_FOUND'),
            message:
              errPayload?.message ??
              (res.status === 410
                ? 'Esta partida ha sido cerrada por el profesor.'
                : 'No existe ninguna partida con ese código.'),
          });
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; state?: GameRoomState };
        if (!data.ok || !data.state) return;

        const latest = get().roomState;
        if (!latest || normalizeRoomCode(latest.roomCode) !== code) return;

        const hasNewerUpdate =
          data.state.status !== latest.status ||
          data.state.updatedAt > latest.updatedAt ||
          data.state.players.length !== latest.players.length ||
          getRoomParticipantStats(data.state).connectedCount !==
            getRoomParticipantStats(latest).connectedCount;

        if (!hasNewerUpdate) return;

        if (latest.status === 'lobby' && data.state.status === 'playing') {
          handleServerMessage({
            type: 'GAME_STARTED',
            roomCode: data.state.roomCode,
            startedAt: data.state.startedAt ?? data.state.updatedAt,
            state: data.state,
          });
        } else {
          handleServerMessage({
            type: 'STATE_SYNC',
            state: data.state,
          });
        }
      } catch {
        // Ignore transient polling failures
      }
    },

    createRoom: async ({ teacherName, teacherPin, config }) => {
      soundEngine.unlockAudio();
      soundEngine.playSfx('menu_open');

      const apiBase = resolveApiBaseUrl();
      const allowLocalFallback = isLocalFallbackEnabled();
      const inProduction = isProductionEnvironment();
      const cleanTeacherPin =
        teacherPin.trim() || `DOC${Math.floor(100 + Math.random() * 900)}`;
      let roomCode = `PRL${Math.floor(100 + Math.random() * 900)}`;
      let initialState = createInitialRoomState(roomCode, config);
      let token = cleanTeacherPin;
      let serverPlayerId = get().playerId;
      let serverPlayerToken = '';
      let createdOnServer = false;
      let serverError: string | null = null;
      let localWorkerUnreachableOnly = false;
      const teacherDisplayName = teacherName.trim() || 'Docente PRL';

      if (!apiBase) {
        serverError =
          'No se ha configurado VITE_API_URL / VITE_WS_URL en Cloudflare Pages para conectar con Cloudflare Workers.';
      } else {
        const targetUrl = `${apiBase}/api/rooms`;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config,
              teacherPin: cleanTeacherPin,
              teacherName: teacherDisplayName,
              teacherId: serverPlayerId,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const payload = (await res.json().catch(() => null)) as {
            ok?: boolean;
            success?: boolean;
            error?: string;
            message?: string;
            roomCode?: string;
            playerId?: string;
            playerToken?: string;
            teacherToken?: string;
            state?: GameRoomState;
          } | null;

          if (res.ok && payload?.ok && payload.roomCode && payload.state) {
            roomCode = normalizeRoomCode(payload.roomCode);
            initialState = payload.state;
            token = payload.teacherToken ?? token;
            serverPlayerId = payload.playerId ?? serverPlayerId;
            serverPlayerToken = payload.playerToken ?? '';
            createdOnServer = true;
          } else {
            serverError = formatServerHttpDiagnostic({
              status: res.status,
              errorCode: payload?.error,
              serverMessage: payload?.message ?? payload?.error,
              targetUrl,
              origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            });
          }
        } catch (err) {
          const isAbort = err instanceof Error && err.name === 'AbortError';
          if (!inProduction && allowLocalFallback && !hasConfiguredApiEnv() && !isAbort) {
            localWorkerUnreachableOnly = true;
          }
          serverError = await diagnoseFetchConnectionFailure({
            error: err,
            apiBase,
            targetUrl,
            actionLabel: 'crear la sala',
          });
        }
      }

      const mustRequireServer =
        inProduction ||
        !allowLocalFallback ||
        hasConfiguredApiEnv() ||
        !localWorkerUnreachableOnly;
      if (!createdOnServer && mustRequireServer) {
        set({
          errorMessage:
            serverError ??
            'No se ha podido crear la sala en el servidor Cloudflare Workers. Comprueba la consola del navegador para ver el detalle técnico.',
        });
        return;
      }

      let resolvedPlayerId = serverPlayerId;
      if (!createdOnServer) {
        console.info('[PRL-OCA][Dev] Creando sala en modo desarrollo local (sin Worker activo).');
        const joinRes = joinPlayerToState(initialState, {
          playerId: serverPlayerId,
          playerName: teacherDisplayName,
          isTeacher: true,
        });
        resolvedPlayerId = joinRes.player?.id ?? serverPlayerId;
      }
      persistSessionPlayerIdentity(resolvedPlayerId, teacherDisplayName);
      if (serverPlayerToken) {
        persistSessionPlayerToken(roomCode, serverPlayerToken);
      }

      set({
        roomState: { ...initialState },
        isRemoteSession: createdOnServer,
        playerId: resolvedPlayerId,
        playerName: teacherDisplayName,
        playerToken: serverPlayerToken,
        isTeacher: true,
        isSpectator: false,
        teacherPin: cleanTeacherPin,
        teacherToken: token,
        screen: 'lobby',
        errorMessage: null,
        isTokenMoving: false,
        challengeModalReady: true,
      });

      mpClient.connect(
        roomCode,
        {
          type: 'JOIN_ROOM',
          actionId: `join_${Date.now()}`,
          playerId: resolvedPlayerId,
          playerName: teacherDisplayName,
          isTeacher: true,
          teacherPin: cleanTeacherPin,
          teacherToken: token || undefined,
          playerToken: serverPlayerToken || undefined,
        },
        (msg: ServerToClientMessage) => handleServerMessage(msg),
        (status) => set({ connectionStatus: status }),
        { useLocalBroadcast: !createdOnServer }
      );
      if (!createdOnServer) {
        mpClient.broadcastLocalState(initialState);
      }
    },

    joinRoom: async ({
      roomCode,
      playerName,
      preferredTeamId,
      isTeacher,
      isSpectator,
      teacherPin,
    }) => {
      soundEngine.unlockAudio();
      soundEngine.playSfx('button_click');

      const cleanCode = normalizeRoomCode(roomCode);
      if (!isValidRoomCodeFormat(cleanCode)) {
        set({
          errorMessage:
            'Formato de código de sala incorrecto. Usa entre 3 y 24 caracteres alfanuméricos sin espacios.',
        });
        return;
      }

      const apiBase = resolveApiBaseUrl();
      const allowLocalFallback = isLocalFallbackEnabled();
      const inProduction = isProductionEnvironment();
      const cleanAlias = playerName.trim() || 'Participante';
      const currentPlayerId = get().playerId;
      const existingToken = loadSessionPlayerToken(cleanCode);

      let state: GameRoomState | null = null;
      let loadedFromServer = false;
      let resolvedPlayerId = currentPlayerId;
      let resolvedPlayerToken = existingToken ?? '';
      let resolvedTeacherToken = get().teacherToken;
      let serverStatus = 0;
      let serverErrorCode: string | undefined;
      let serverErrorMessage: string | null = null;

      if (inProduction && !apiBase) {
        set({
          errorMessage:
            'No se ha podido verificar la sala. Comprueba tu conexión e inténtalo de nuevo.',
        });
        return;
      }

      if (apiBase) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(`${apiBase}/api/rooms/${cleanCode}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomCode: cleanCode,
              playerId: currentPlayerId,
              playerName: cleanAlias,
              preferredTeamId,
              isTeacher,
              isSpectator,
              teacherPin,
              playerToken: existingToken,
            }),
            signal: controller.signal,
            cache: 'no-store',
          });
          clearTimeout(timeout);
          serverStatus = res.status;

          const payload = (await res.json().catch(() => null)) as {
            success?: boolean;
            ok?: boolean;
            error?: string;
            message?: string;
            playerId?: string;
            playerToken?: string;
            teacherToken?: string;
            state?: GameRoomState;
          } | null;

          if (res.ok && payload?.ok && payload.state) {
            state = payload.state;
            loadedFromServer = true;
            resolvedPlayerId = payload.playerId ?? currentPlayerId;
            resolvedPlayerToken = payload.playerToken ?? resolvedPlayerToken;
            if (payload.teacherToken) {
              resolvedTeacherToken = payload.teacherToken;
            }
          } else {
            serverErrorCode = payload?.error;
            serverErrorMessage = formatServerHttpDiagnostic({
              status: res.status,
              errorCode: payload?.error,
              serverMessage: payload?.message ?? payload?.error,
              targetUrl: `${apiBase}/api/rooms/${cleanCode}/join`,
              origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            });
          }
        } catch (err) {
          console.error('[PRL-OCA][JoinRoom] Fallo de red/CORS verificando sala', {
            roomCode: cleanCode,
            apiBase,
            error: err instanceof Error ? err.message : String(err),
          });
          serverErrorMessage =
            'No se ha podido verificar la sala. Comprueba tu conexión e inténtalo de nuevo.';
        }
      }

      // Definitive rejection when the Worker rejected the room/join request (400, 403, 404, 409, 410)
      if (serverStatus >= 400 && serverStatus < 500) {
        set({
          errorMessage: mapRoomErrorMessage(serverErrorCode, serverErrorMessage ?? undefined),
        });
        return;
      }

      // In production or when server validation failed/unreachable, NEVER fall back to fake local rooms
      if (!loadedFromServer) {
        const localOnlyMode = !inProduction && allowLocalFallback && !hasConfiguredApiEnv();
        const cachedLocalState = localOnlyMode ? mpClient.loadCachedRoomState(cleanCode) : null;
        if (cachedLocalState) {
          state = cachedLocalState;
        } else {
          set({
            errorMessage:
              serverStatus === 0 || serverStatus >= 500
                ? serverErrorMessage ??
                  'No se ha podido verificar la sala. Comprueba tu conexión e inténtalo de nuevo.'
                : mapRoomErrorMessage(serverErrorCode, serverErrorMessage ?? undefined),
          });
          return;
        }
      }

      if (!state) {
        set({
          errorMessage: 'No existe ninguna partida con ese código.',
        });
        return;
      }

      if (!loadedFromServer) {
        const joinRes = joinPlayerToState(state, {
          playerId: resolvedPlayerId,
          playerName: cleanAlias,
          preferredTeamId,
          isTeacher,
          isSpectator,
        });

        if (!joinRes.ok) {
          set({
            errorMessage: mapRoomErrorMessage(joinRes.errorCode, joinRes.error),
          });
          return;
        }
        resolvedPlayerId = joinRes.player?.id ?? resolvedPlayerId;
      }
      persistSessionPlayerIdentity(resolvedPlayerId, cleanAlias);
      persistSessionPlayerToken(cleanCode, resolvedPlayerToken);

      const targetScreen = deriveScreenFromRoomState(state);

      set({
        roomState: { ...state },
        isRemoteSession: loadedFromServer,
        playerId: resolvedPlayerId,
        playerName: cleanAlias,
        playerToken: resolvedPlayerToken,
        teacherToken: resolvedTeacherToken,
        isTeacher: Boolean(isTeacher),
        isSpectator: Boolean(isSpectator),
        projectorMode: Boolean(isSpectator),
        teacherPin: teacherPin ?? get().teacherPin,
        screen: targetScreen,
        errorMessage: null,
        isTokenMoving: false,
        challengeModalReady: true,
      });

      mpClient.connect(
        cleanCode,
        {
          type: 'JOIN_ROOM',
          actionId: `join_${Date.now()}`,
          playerId: resolvedPlayerId,
          playerName: cleanAlias,
          preferredTeamId,
          isTeacher,
          isSpectator,
          teacherPin,
          teacherToken: resolvedTeacherToken || undefined,
          playerToken: resolvedPlayerToken || undefined,
        },
        (msg) => handleServerMessage(msg),
        (status) => set({ connectionStatus: status }),
        { useLocalBroadcast: !loadedFromServer }
      );
      if (!loadedFromServer) {
        mpClient.broadcastLocalState(state);
      }
      if (targetScreen === 'game') {
        void enterGameLandscapeMode();
      }
    },

    startIndividualGame: (playerName) => {
      clearMovementTimers();
      soundEngine.unlockAudio();
      soundEngine.playSfx('challenge_start');
      soundEngine.playMusic('board');

      const code = `SOLO${Math.floor(10 + Math.random() * 89)}`;
      const state = createInitialRoomState(code, {
        roomName: 'Entrenamiento Individual PRL 3D',
        mode: 'individual',
        teamCount: 2,
        maxPlayers: 2,
        diceMode: '1d6',
      });

      const playerId = get().playerId;
      joinPlayerToState(state, {
        playerId,
        playerName: playerName || 'Especialista PRL',
        preferredTeamId: 'team_1',
        isTeacher: false,
      });
      joinPlayerToState(state, {
        playerId: 'bot_companero',
        playerName: 'Brigada Preventiva IA',
        preferredTeamId: 'team_2',
      });

      state.status = 'playing';
      refreshAllTeamRoles(state);

      set({
        roomState: { ...state },
        isRemoteSession: false,
        playerName: playerName || 'Especialista PRL',
        isTeacher: true,
        isSpectator: false,
        connectionStatus: 'local_sync',
        screen: 'game',
        cameraView: 'isometric',
        isRollingAnimation: false,
        isTokenMoving: false,
        challengeModalReady: true,
      });
      void enterGameLandscapeMode();
    },

    populate15DemoPlayers: () => {
      const state = get().roomState;
      if (!state) return;
      soundEngine.playSfx('reward');

      const demoNames = [
        'Ana García',
        'Carlos Ruiz',
        'Elena Martín',
        'David López',
        'Laura Sánchez',
        'Miguel Fernández',
        'Sofía Gómez',
        'Javier Díaz',
        'Lucía Moreno',
        'Daniel Álvarez',
        'Paula Romero',
        'Alejandro Navarro',
        'Marta Torres',
        'Pablo Domínguez',
        'Claudia Vázquez',
      ];

      const currentParticipants = state.players.filter((p) => !p.isTeacher && !p.isSpectator);
      const needed = Math.max(0, state.config.maxPlayers - currentParticipants.length);

      for (let i = 0; i < needed; i++) {
        const idx = currentParticipants.length + i;
        const name = demoNames[idx % demoNames.length];
        const team = state.teams[idx % state.teams.length];
        const pId = `demo_p_${idx + 1}`;
        joinPlayerToState(state, {
          playerId: pId,
          playerName: name,
          preferredTeamId: team?.id,
        });
        if (get().connectionStatus === 'connected') {
          mpClient.send({
            type: 'JOIN_ROOM',
            actionId: `demo_join_${pId}_${Date.now()}`,
            playerId: pId,
            playerName: name,
            preferredTeamId: team?.id,
          });
        }
      }

      set({ roomState: { ...state } });
      mpClient.broadcastLocalState(state);
    },

    markLocalDisconnect: () => {
      const state = get().roomState;
      if (!state || get().connectionStatus === 'connected') return;
      if (disconnectPlayerFromState(state, get().playerId)) {
        mpClient.broadcastLocalState(state);
      }
    },

    leaveRoom: () => {
      clearMovementTimers();
      get().markLocalDisconnect();
      mpClient.disconnect();
      soundEngine.playMusic('menu');
      void exitGameLandscapeMode();
      set({
        roomState: null,
        isRemoteSession: false,
        playerToken: '',
        screen: 'home',
        projectorMode: false,
        showTeacherPanel: false,
        isRollingAnimation: false,
        isTokenMoving: false,
        challengeModalReady: true,
      });
    },

    closeRoom: async () => {
      const state = get().roomState;
      if (state && get().isTeacher) {
        await get().runTeacherCommand({ kind: 'CLOSE_ROOM' });
      }
      get().leaveRoom();
    },

    selectTeamInLobby: (teamId) => {
      const state = get().roomState;
      if (!state) return;
      soundEngine.playSfx('button_click');

      const playerId = get().playerId;
      const pToken = get().playerToken || loadSessionPlayerToken(state.roomCode);
      const slotKey = `${normalizeRoomCode(state.roomCode)}:SELECT_TEAM:${teamId}`;
      const msg = {
        type: 'SELECT_TEAM' as const,
        actionId: getOrCreateIdempotentActionId(slotKey, 'sel'),
        playerId,
        teamId,
        playerToken: pToken,
      };
      if (mpClient.isConnected() && get().connectionStatus === 'connected') {
        if (mpClient.send(msg)) return;
      }

      if (get().isRemoteSession || isProductionEnvironment() || !isLocalFallbackEnabled()) {
        mpClient.forceReconnectIfNeeded();
        void sendRemoteGameplayAction({
          roomCode: state.roomCode,
          slotKey,
          actionLabel: 'cambiar de equipo',
          msg,
        });
        return;
      }

      const player = state.players.find((p) => p.id === playerId);
      if (player) {
        player.teamId = teamId;
        refreshAllTeamRoles(state);
        set({ roomState: { ...state } });
        mpClient.broadcastLocalState(state);
      }
    },

    toggleReadyInLobby: () => {
      const state = get().roomState;
      if (!state) return;
      soundEngine.playSfx('button_click');

      const playerId = get().playerId;
      const pToken = get().playerToken || loadSessionPlayerToken(state.roomCode);
      const slotKey = `${normalizeRoomCode(state.roomCode)}:TOGGLE_READY:${state.updatedAt}`;
      const msg = {
        type: 'TOGGLE_READY' as const,
        actionId: getOrCreateIdempotentActionId(slotKey, 'rdy'),
        playerId,
        playerToken: pToken,
      };
      if (mpClient.isConnected() && get().connectionStatus === 'connected') {
        if (mpClient.send(msg)) return;
      }

      if (get().isRemoteSession || isProductionEnvironment() || !isLocalFallbackEnabled()) {
        mpClient.forceReconnectIfNeeded();
        void sendRemoteGameplayAction({
          roomCode: state.roomCode,
          slotKey,
          actionLabel: 'actualizar estado de preparación',
          msg,
        });
        return;
      }

      const player = state.players.find((p) => p.id === playerId);
      if (player) {
        player.ready = !player.ready;
        set({ roomState: { ...state } });
        mpClient.broadcastLocalState(state);
      }
    },

    rollDice: () => {
      const state = get().roomState;
      if (!state || get().isRollingAnimation || get().isTokenMoving) return;

      const rollSlotKey = `${normalizeRoomCode(state.roomCode)}:${state.turnNumber}:waiting_roll:ROLL_DICE`;
      if (inFlightSlotActions.has(rollSlotKey)) {
        return;
      }

      clearMovementTimers();
      soundEngine.playSfx('dice_throw');
      set((s) => ({
        isRollingAnimation: true,
        isTokenMoving: false,
        challengeModalReady: false,
        cameraView: 'dice',
        cameraResetKey: s.cameraResetKey + 1,
        errorMessage: null,
      }));

      const playerId = get().playerId;
      const pToken = get().playerToken || loadSessionPlayerToken(state.roomCode);

      // 1.15s of 3D dice tumbling before settling on the server-determined face
      setTimeout(() => {
        const curRoom = get().roomState;
        if (!curRoom) {
          set({ isRollingAnimation: false, challengeModalReady: true });
          return;
        }

        const slotKey = `${normalizeRoomCode(curRoom.roomCode)}:${curRoom.turnNumber}:waiting_roll:ROLL_DICE`;
        const msg = {
          type: 'ROLL_DICE' as const,
          actionId: getOrCreateIdempotentActionId(slotKey, 'roll'),
          playerId,
          playerToken: pToken,
        };

        if (mpClient.isConnected() && get().connectionStatus === 'connected') {
          if (mpClient.send(msg)) {
            return;
          }
        }

        // Authoritative HTTP fallback when playing remotely (NEVER silently run local fallback)
        if (get().isRemoteSession || isProductionEnvironment() || !isLocalFallbackEnabled()) {
          mpClient.forceReconnectIfNeeded();
          void sendRemoteGameplayAction({
            roomCode: curRoom.roomCode,
            slotKey,
            actionLabel: 'enviar el lanzamiento de dados',
            msg,
            onFailureReset: () =>
              set({
                isRollingAnimation: false,
                isTokenMoving: false,
                challengeModalReady: true,
              }),
          });
          return;
        }

        const activeTeam = curRoom.teams[curRoom.activeTeamIndex];
        const effectiveRoller =
          curRoom.players.find((p) => p.teamId === activeTeam?.id)?.id ?? playerId;

        const res = rollDiceServerSide(curRoom, effectiveRoller, get().questionBank);
        if (!res.ok) {
          set({
            isRollingAnimation: false,
            isTokenMoving: false,
            challengeModalReady: true,
            errorMessage: res.error ?? null,
          });
          return;
        }

        soundEngine.playSfx('dice_hit');
        set({
          roomState: { ...curRoom },
          isRollingAnimation: false,
          isTokenMoving: true,
          challengeModalReady: false,
        });
        scheduleMovementSequence(curRoom);
        mpClient.broadcastLocalState(curRoom);
      }, 1150);
    },

    submitAnswer: (selectedIndices, collaborated = true) => {
      const state = get().roomState;
      if (!state) return;

      const playerId = get().playerId;
      const pToken = get().playerToken || loadSessionPlayerToken(state.roomCode);
      const slotKey = `${normalizeRoomCode(state.roomCode)}:${state.turnNumber}:SUBMIT_ANSWER`;
      const msg = {
        type: 'SUBMIT_ANSWER' as const,
        actionId: getOrCreateIdempotentActionId(slotKey, 'ans'),
        playerId,
        selectedIndices,
        collaborated,
        playerToken: pToken,
      };
      if (mpClient.isConnected() && get().connectionStatus === 'connected') {
        if (mpClient.send(msg)) return;
      }

      if (get().isRemoteSession || isProductionEnvironment() || !isLocalFallbackEnabled()) {
        mpClient.forceReconnectIfNeeded();
        void sendRemoteGameplayAction({
          roomCode: state.roomCode,
          slotKey,
          actionLabel: 'enviar la respuesta',
          msg,
        });
        return;
      }

      const activeTeam = state.teams[state.activeTeamIndex];
      const effectivePlayer =
        state.players.find((p) => p.teamId === activeTeam?.id)?.id ?? playerId;

      const res = submitAnswerServerSide(state, effectivePlayer, selectedIndices, collaborated);
      if (!res.ok) {
        set({ errorMessage: res.error ?? null });
        return;
      }

      soundEngine.playSfx(res.isCorrect ? 'answer_correct' : 'answer_wrong');
      if (res.unlockedBadges && res.unlockedBadges.length > 0) {
        setTimeout(() => soundEngine.playSfx('badge_unlock'), 400);
      }
      soundEngine.playMusic('board');

      if (state.status === 'finished') {
        soundEngine.playSfx('victory_fanfare');
        soundEngine.playMusic('victory');
        const record = buildMatchHistoryFromState(state);
        const updatedHistory = [record, ...get().matchHistory].slice(0, 50);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
        }
        set({
          roomState: { ...state },
          matchHistory: updatedHistory,
          screen: 'victory',
          cameraView: 'goal',
        });
      } else {
        set({ roomState: { ...state } });
      }
      mpClient.broadcastLocalState(state);
    },

    completeChallenge3D: (selectedHotspotIds) => {
      const state = get().roomState;
      if (!state) return;

      const playerId = get().playerId;
      const pToken = get().playerToken || loadSessionPlayerToken(state.roomCode);
      const slotKey = `${normalizeRoomCode(state.roomCode)}:${state.turnNumber}:COMPLETE_CHALLENGE_3D`;
      const msg = {
        type: 'COMPLETE_CHALLENGE_3D' as const,
        actionId: getOrCreateIdempotentActionId(slotKey, 'ch3d'),
        playerId,
        selectedHotspotIds,
        playerToken: pToken,
      };
      if (mpClient.isConnected() && get().connectionStatus === 'connected') {
        if (mpClient.send(msg)) return;
      }

      if (get().isRemoteSession || isProductionEnvironment() || !isLocalFallbackEnabled()) {
        mpClient.forceReconnectIfNeeded();
        void sendRemoteGameplayAction({
          roomCode: state.roomCode,
          slotKey,
          actionLabel: 'validar el desafío 3D',
          msg,
        });
        return;
      }

      const activeTeam = state.teams[state.activeTeamIndex];
      const effectivePlayer =
        state.players.find((p) => p.teamId === activeTeam?.id)?.id ?? playerId;

      const res = completeChallenge3DServerSide(state, effectivePlayer, selectedHotspotIds);
      if (!res.ok) {
        set({ errorMessage: res.error ?? null });
        return;
      }

      soundEngine.playSfx(res.isCorrect ? 'answer_correct' : 'answer_wrong');
      if (res.unlockedBadges && res.unlockedBadges.length > 0) {
        setTimeout(() => soundEngine.playSfx('badge_unlock'), 400);
      }
      soundEngine.playMusic('board');

      set({ roomState: { ...state } });
      mpClient.broadcastLocalState(state);
    },

    nextTurn: () => {
      const state = get().roomState;
      if (!state) return;
      clearMovementTimers();
      soundEngine.playSfx('button_click');
      soundEngine.playMusic('board');

      const playerId = get().playerId;
      const pToken = get().playerToken || loadSessionPlayerToken(state.roomCode);
      const slotKey = `${normalizeRoomCode(state.roomCode)}:${state.turnNumber}:${state.phase}:NEXT_TURN`;
      const msg = {
        type: 'NEXT_TURN' as const,
        actionId: getOrCreateIdempotentActionId(slotKey, 'nxt'),
        playerId,
        playerToken: pToken,
      };
      if (mpClient.isConnected() && get().connectionStatus === 'connected') {
        if (mpClient.send(msg)) return;
      }

      if (get().isRemoteSession || isProductionEnvironment() || !isLocalFallbackEnabled()) {
        mpClient.forceReconnectIfNeeded();
        void sendRemoteGameplayAction({
          roomCode: state.roomCode,
          slotKey,
          actionLabel: 'avanzar al siguiente turno',
          msg,
        });
        return;
      }

      advanceTurnServerSide(state);
      set((s) => ({
        roomState: { ...state },
        cameraView: 'isometric',
        cameraResetKey: s.cameraResetKey + 1,
        isTokenMoving: false,
        challengeModalReady: true,
      }));
      mpClient.broadcastLocalState(state);

      // If in Solo mode and the next turn belongs to Brigada Preventiva IA, auto-roll after 800ms
      const nextTeam = state.teams[state.activeTeamIndex];
      const isBotNext = state.players.some(
        (p) => p.id === 'bot_companero' && p.teamId === nextTeam?.id
      );
      if (isBotNext && state.status === 'playing') {
        setTimeout(() => {
          if (get().screen === 'game' && get().roomState?.phase === 'waiting_roll') {
            get().rollDice();
          }
        }, 800);
      }
    },

    runTeacherCommand: async (command) => {
      const state = get().roomState;
      if (!state) return;
      clearMovementTimers();
      soundEngine.playSfx('button_click');
      set({ errorMessage: null });

      const normalizedCode = normalizeRoomCode(state.roomCode);
      const mustUseRemote = get().isRemoteSession || !isLocalFallbackEnabled();
      const teacherCmd = command as Extract<
        Parameters<typeof mpClient.send>[0],
        { type: 'TEACHER_ACTION' }
      >['command'];

      const sendHttpTeacherAction = async () => {
        const apiBase = resolveApiBaseUrl();
        if (!apiBase) {
          set({
            errorMessage:
              'Sin conexión con el servidor Cloudflare Workers. Revisa tu conexión antes de iniciar.',
          });
          return;
        }
        try {
          console.info(
            `[PRL-OCA][Teacher] Executing ${teacherCmd.kind} via HTTP authoritative endpoint (room=${normalizedCode})`
          );
          const res = await fetch(`${apiBase}/api/rooms/${normalizedCode}/teacher-action`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Teacher-Token': get().teacherToken,
            },
            body: JSON.stringify({
              teacherToken: get().teacherToken,
              command: teacherCmd,
            }),
          });
          const data = (await res.json().catch(() => null)) as {
            ok?: boolean;
            error?: string;
            startedAt?: number;
            state?: GameRoomState;
          } | null;

          if (!res.ok || !data?.ok || !data.state) {
            set({
              errorMessage:
                data?.error ??
                `No se pudo sincronizar la acción docente (${teacherCmd.kind}) con el servidor.`,
            });
            return;
          }

          if (teacherCmd.kind === 'START_GAME') {
            handleServerMessage({
              type: 'GAME_STARTED',
              roomCode: data.state.roomCode,
              startedAt: data.startedAt ?? data.state.startedAt ?? Date.now(),
              state: data.state,
            });
          } else {
            handleServerMessage({
              type: 'STATE_SYNC',
              state: data.state,
            });
          }
        } catch {
          set({
            errorMessage:
              'Error de red al enviar la orden del docente al servidor Cloudflare Workers.',
          });
        }
      };

      if (mpClient.isConnected() && get().connectionStatus === 'connected') {
        console.info(
          `[PRL-OCA][Teacher] Sending TEACHER_ACTION via WebSocket: ${teacherCmd.kind} (room=${normalizedCode})`
        );
        const sent = mpClient.send({
          type: 'TEACHER_ACTION',
          actionId: `tcmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          teacherToken: get().teacherToken,
          command: teacherCmd,
        });

        if (sent) {
          if (teacherCmd.kind === 'START_GAME') {
            // If WS confirmation hasn't transitioned out of lobby within 1.5s, fall back to authoritative HTTP endpoint
            setTimeout(() => {
              const cur = get().roomState;
              if (cur && normalizeRoomCode(cur.roomCode) === normalizedCode && cur.status === 'lobby') {
                console.warn(
                  `[PRL-OCA][Teacher] START_GAME WS confirmation pending after 1500ms; confirming via HTTP`
                );
                void sendHttpTeacherAction();
              }
            }, 1500);
          }
          return;
        }
      }

      if (mustUseRemote) {
        mpClient.forceReconnectIfNeeded();
        await sendHttpTeacherAction();
        return;
      }

      // Pure offline / demo fallback (only when no backend room was created)
      const res = executeTeacherCommandServerSide(state, command, get().questionBank);
      if (!res.ok) {
        set({ errorMessage: res.error ?? null });
        return;
      }

      const nextScreen =
        state.status === 'playing' || state.status === 'paused'
          ? 'game'
          : state.status === 'finished'
          ? 'victory'
          : get().screen;

      if (state.status === 'playing' || state.status === 'paused') {
        soundEngine.playMusic('board');
      } else if (state.status === 'finished') {
        soundEngine.playSfx('victory_fanfare');
        soundEngine.playMusic('victory');
        const record = buildMatchHistoryFromState(state);
        const updatedHistory = [record, ...get().matchHistory].slice(0, 50);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
        }
        set({ matchHistory: updatedHistory });
      }

      set({
        roomState: { ...state },
        screen: nextScreen,
        isTokenMoving: false,
        challengeModalReady: true,
      });
      if (nextScreen === 'game') {
        void enterGameLandscapeMode();
      }
      mpClient.broadcastLocalState(state);
    },

    saveQuestion: (item) => {
      soundEngine.playSfx('reward');
      const current = [...get().questionBank];
      const idx = current.findIndex((q) => q.id === item.id);
      if (idx >= 0) {
        current[idx] = item;
      } else {
        current.unshift(item);
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(current));
      }
      set({ questionBank: current });
    },

    deleteQuestion: (id) => {
      soundEngine.playSfx('button_click');
      const updated = get().questionBank.filter((q) => q.id !== id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(updated));
      }
      set({ questionBank: updated });
    },

    duplicateQuestion: (id) => {
      soundEngine.playSfx('button_click');
      const orig = get().questionBank.find((q) => q.id === id);
      if (!orig) return;
      const copy: QuestionItem = {
        ...orig,
        id: `q_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `${orig.title} (Copia)`,
      };
      const updated = [copy, ...get().questionBank];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(updated));
      }
      set({ questionBank: updated });
    },

    toggleQuestionActive: (id) => {
      const updated = get().questionBank.map((q) =>
        q.id === id ? { ...q, active: !q.active } : q
      );
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(updated));
      }
      set({ questionBank: updated });
    },

    importQuestions: (items) => {
      soundEngine.playSfx('reward');
      const map = new Map<string, QuestionItem>();
      for (const q of get().questionBank) {
        map.set(q.id, q);
      }
      for (const incoming of items) {
        map.set(incoming.id, incoming);
      }
      const merged = Array.from(map.values());
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(merged));
      }
      set({ questionBank: merged });
    },

    resetQuestionBank: () => {
      soundEngine.playSfx('button_click');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(QUESTIONS_STORAGE_KEY);
      }
      set({ questionBank: [...INITIAL_QUESTION_BANK] });
    },
  };
});
