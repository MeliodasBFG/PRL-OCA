import { create } from 'zustand';
import {
  CameraViewMode,
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
  executeTeacherCommandServerSide,
  joinPlayerToState,
  refreshAllTeamRoles,
  rollDiceServerSide,
  submitAnswerServerSide,
} from '@prl-oca/shared';
import { ConnectionState, mpClient } from '../multiplayer/wsClient';
import { soundEngine } from '../audio/SoundEngine';

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

function detectDefaultGraphicsQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'alta';
  const isMobile = window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
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

function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'player_local';
  const key = 'prl_oca_player_id';
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `plr_${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(key, created);
  return created;
}

export interface GameStore {
  screen: AppScreen;
  createJoinTab: 'create' | 'join';
  connectionStatus: ConnectionState;
  roomState: GameRoomState | null;
  playerId: string;
  playerName: string;
  isTeacher: boolean;
  isSpectator: boolean;
  projectorMode: boolean;
  teacherPin: string;
  teacherToken: string;
  errorMessage: string | null;
  captionToast: string | null;

  // Camera & Visuals
  cameraView: CameraViewMode;
  graphicsQuality: GraphicsQuality;
  board2DMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  isRollingAnimation: boolean;

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
  leaveRoom: () => void;

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
    partialConfig?: Partial<GameConfig>;
  }) => void;

  // Question Bank CRUD
  saveQuestion: (item: QuestionItem) => void;
  deleteQuestion: (id: string) => void;
  duplicateQuestion: (id: string) => void;
  toggleQuestionActive: (id: string) => void;
  importQuestions: (items: QuestionItem[]) => void;
  resetQuestionBank: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'home',
  createJoinTab: 'create',
  connectionStatus: 'disconnected',
  roomState: null,
  playerId: getOrCreatePlayerId(),
  playerName: 'Participante PRL',
  isTeacher: false,
  isSpectator: false,
  projectorMode: false,
  teacherPin: 'PRL2026',
  teacherToken: 'PRL2026',
  errorMessage: null,
  captionToast: null,

  cameraView: 'isometric',
  graphicsQuality: detectDefaultGraphicsQuality(),
  board2DMode: false,
  highContrast: false,
  reducedMotion: false,
  isRollingAnimation: false,

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
    } else if (screen === 'victory') {
      soundEngine.playMusic('victory');
    }
    set({ screen, errorMessage: null });
  },

  setCreateJoinTab: (createJoinTab) => set({ createJoinTab, errorMessage: null }),
  setCameraView: (cameraView) => {
    soundEngine.playSfx('button_click');
    set({ cameraView });
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
  setProjectorMode: (projectorMode) => set({ projectorMode, showTeacherPanel: false }),
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

  createRoom: async ({ teacherName, teacherPin, config }) => {
    soundEngine.unlockAudio();
    soundEngine.playSfx('menu_open');

    const apiBase =
      (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8787';
    let roomCode = `PRL${Math.floor(100 + Math.random() * 900)}`;
    let initialState = createInitialRoomState(roomCode, config);
    let token = teacherPin || 'PRL2026';

    // Attempt to create room on Cloudflare Worker if running
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, teacherPin, teacherName }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          roomCode: string;
          teacherToken: string;
          state: GameRoomState;
        };
        if (data.ok && data.roomCode) {
          roomCode = data.roomCode;
          initialState = data.state;
          token = data.teacherToken;
        }
      }
    } catch {
      // Worker offline -> use local authoritative engine + BroadcastChannel sync
    }

    const playerId = get().playerId;
    joinPlayerToState(initialState, {
      playerId,
      playerName: teacherName || 'Docente PRL',
      isTeacher: true,
    });

    set({
      roomState: { ...initialState },
      playerName: teacherName || 'Docente PRL',
      isTeacher: true,
      isSpectator: false,
      teacherPin: teacherPin || 'PRL2026',
      teacherToken: token,
      screen: 'lobby',
      errorMessage: null,
    });

    mpClient.broadcastLocalState(initialState);

    mpClient.connect(
      roomCode,
      {
        type: 'JOIN_ROOM',
        actionId: `join_${Date.now()}`,
        playerId,
        playerName: teacherName || 'Docente PRL',
        isTeacher: true,
        teacherPin: teacherPin || 'PRL2026',
      },
      (msg: ServerToClientMessage) => {
        if (msg.type === 'STATE_SYNC') {
          const nextScreen =
            msg.state.status === 'finished'
              ? 'victory'
              : msg.state.status === 'playing' || msg.state.status === 'paused'
              ? 'game'
              : 'lobby';
          set({
            roomState: msg.state,
            teacherToken: msg.teacherToken ?? get().teacherToken,
            screen: nextScreen,
          });
        } else if (msg.type === 'DICE_ROLLED') {
          soundEngine.playSfx('dice_hit');
          set({ roomState: msg.state, cameraView: 'active_tile' });
        } else if (msg.type === 'ANSWER_RESULT') {
          soundEngine.playSfx(msg.isCorrect ? 'answer_correct' : 'answer_wrong');
          if (msg.unlockedBadges.length > 0) {
            setTimeout(() => soundEngine.playSfx('badge_unlock'), 350);
          }
          set({
            roomState: msg.state,
            screen: msg.state.status === 'finished' ? 'victory' : 'game',
          });
        } else if (msg.type === 'ERROR') {
          set({ errorMessage: msg.message });
        }
      },
      (status) => set({ connectionStatus: status })
    );
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

    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) {
      set({ errorMessage: 'Introduce un código de sala válido.' });
      return;
    }

    const apiBase =
      (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8787';
    let state = mpClient.loadCachedRoomState(cleanCode);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/rooms/${cleanCode}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; state: GameRoomState };
        if (data.ok && data.state) {
          state = data.state;
        }
      }
    } catch {
      // Fallback to cached or new local state
    }

    if (!state) {
      state = createInitialRoomState(cleanCode);
    }

    const playerId = get().playerId;
    const joinRes = joinPlayerToState(state, {
      playerId,
      playerName: playerName.trim() || 'Participante',
      preferredTeamId,
      isTeacher,
      isSpectator,
    });

    if (!joinRes.ok) {
      set({ errorMessage: joinRes.error ?? 'No fue posible entrar en la sala.' });
      return;
    }

    const targetScreen: AppScreen =
      state.status === 'playing' || state.status === 'paused' ? 'game' : 'lobby';

    set({
      roomState: { ...state },
      playerName: playerName.trim() || 'Participante',
      isTeacher: Boolean(isTeacher),
      isSpectator: Boolean(isSpectator),
      projectorMode: Boolean(isSpectator),
      teacherPin: teacherPin ?? get().teacherPin,
      screen: targetScreen,
      errorMessage: null,
    });

    mpClient.broadcastLocalState(state);

    mpClient.connect(
      cleanCode,
      {
        type: 'JOIN_ROOM',
        actionId: `join_${Date.now()}`,
        playerId,
        playerName: playerName.trim() || 'Participante',
        preferredTeamId,
        isTeacher,
        isSpectator,
        teacherPin,
      },
      (msg) => {
        if (msg.type === 'STATE_SYNC') {
          const nextScreen =
            msg.state.status === 'finished'
              ? 'victory'
              : msg.state.status === 'playing' || msg.state.status === 'paused'
              ? 'game'
              : 'lobby';
          set({
            roomState: msg.state,
            teacherToken: msg.teacherToken ?? get().teacherToken,
            screen: nextScreen,
          });
        } else if (msg.type === 'DICE_ROLLED') {
          soundEngine.playSfx('dice_hit');
          set({ roomState: msg.state, cameraView: 'active_tile' });
        } else if (msg.type === 'ANSWER_RESULT') {
          soundEngine.playSfx(msg.isCorrect ? 'answer_correct' : 'answer_wrong');
          set({
            roomState: msg.state,
            screen: msg.state.status === 'finished' ? 'victory' : 'game',
          });
        } else if (msg.type === 'ERROR') {
          set({ errorMessage: msg.message });
        }
      },
      (status) => set({ connectionStatus: status })
    );
  },

  startIndividualGame: (playerName) => {
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
      isTeacher: true,
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
      playerName: playerName || 'Especialista PRL',
      isTeacher: true,
      isSpectator: false,
      connectionStatus: 'local_sync',
      screen: 'game',
      cameraView: 'isometric',
    });
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

  leaveRoom: () => {
    mpClient.disconnect();
    soundEngine.playMusic('menu');
    set({
      roomState: null,
      screen: 'home',
      projectorMode: false,
      showTeacherPanel: false,
    });
  },

  selectTeamInLobby: (teamId) => {
    const state = get().roomState;
    if (!state) return;
    soundEngine.playSfx('button_click');

    const playerId = get().playerId;
    if (get().connectionStatus === 'connected') {
      mpClient.send({
        type: 'SELECT_TEAM',
        actionId: `sel_${Date.now()}`,
        playerId,
        teamId,
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
    if (get().connectionStatus === 'connected') {
      mpClient.send({
        type: 'TOGGLE_READY',
        actionId: `rdy_${Date.now()}`,
        playerId,
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
    if (!state || get().isRollingAnimation) return;

    soundEngine.playSfx('dice_throw');
    set({ isRollingAnimation: true, cameraView: 'dice', errorMessage: null });

    const playerId = get().playerId;

    setTimeout(() => {
      if (get().connectionStatus === 'connected') {
        mpClient.send({
          type: 'ROLL_DICE',
          actionId: `roll_${Date.now()}`,
          playerId,
        });
        set({ isRollingAnimation: false });
        return;
      }

      const currentState = get().roomState;
      if (!currentState) {
        set({ isRollingAnimation: false });
        return;
      }

      // Allow active team member or teacher/host to roll in local/multi-tab mode
      const activeTeam = currentState.teams[currentState.activeTeamIndex];
      const effectiveRoller =
        currentState.players.find((p) => p.teamId === activeTeam?.id)?.id ?? playerId;

      const res = rollDiceServerSide(currentState, effectiveRoller, get().questionBank);
      if (!res.ok) {
        set({ isRollingAnimation: false, errorMessage: res.error ?? null });
        return;
      }

      soundEngine.playSfx('dice_hit');
      setTimeout(() => {
        soundEngine.playSfx('tile_arrive');
        if (currentState.activeChallenge) {
          soundEngine.playMusic(
            currentState.activeChallenge.kind === 'challenge3d' ? 'emergency' : 'suspense'
          );
        }
      }, 600);

      set({
        roomState: { ...currentState },
        isRollingAnimation: false,
        cameraView: 'active_tile',
      });
      mpClient.broadcastLocalState(currentState);
    }, 650);
  },

  submitAnswer: (selectedIndices, collaborated = true) => {
    const state = get().roomState;
    if (!state) return;

    const playerId = get().playerId;
    if (get().connectionStatus === 'connected') {
      mpClient.send({
        type: 'SUBMIT_ANSWER',
        actionId: `ans_${Date.now()}`,
        playerId,
        selectedIndices,
        collaborated,
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
    if (get().connectionStatus === 'connected') {
      mpClient.send({
        type: 'COMPLETE_CHALLENGE_3D',
        actionId: `ch3d_${Date.now()}`,
        playerId,
        selectedHotspotIds,
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
    soundEngine.playSfx('button_click');
    soundEngine.playMusic('board');

    const playerId = get().playerId;
    if (get().connectionStatus === 'connected') {
      mpClient.send({
        type: 'NEXT_TURN',
        actionId: `nxt_${Date.now()}`,
        playerId,
      });
      return;
    }

    advanceTurnServerSide(state);
    set({ roomState: { ...state }, cameraView: 'isometric' });
    mpClient.broadcastLocalState(state);
  },

  runTeacherCommand: (command) => {
    const state = get().roomState;
    if (!state) return;
    soundEngine.playSfx('button_click');

    if (get().connectionStatus === 'connected') {
      mpClient.send({
        type: 'TEACHER_ACTION',
        actionId: `tcmd_${Date.now()}`,
        teacherToken: get().teacherToken,
        command: command as Extract<
          Parameters<typeof mpClient.send>[0],
          { type: 'TEACHER_ACTION' }
        >['command'],
      });
      return;
    }

    const res = executeTeacherCommandServerSide(state, command, get().questionBank);
    if (!res.ok) {
      set({ errorMessage: res.error ?? null });
      return;
    }

    let nextScreen: AppScreen = get().screen;
    if (state.status === 'playing' || state.status === 'paused') {
      nextScreen = 'game';
      soundEngine.playMusic('board');
    } else if (state.status === 'finished') {
      nextScreen = 'victory';
      soundEngine.playSfx('victory_fanfare');
      soundEngine.playMusic('victory');
      const record = buildMatchHistoryFromState(state);
      const updatedHistory = [record, ...get().matchHistory].slice(0, 50);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      }
      set({ matchHistory: updatedHistory });
    }

    set({ roomState: { ...state }, screen: nextScreen });
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
}));
