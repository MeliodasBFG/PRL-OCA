export type PRLCategory =
  | 'conceptos_basicos'
  | 'identificacion_peligros'
  | 'evaluacion_riesgos'
  | 'senalizacion'
  | 'epi'
  | 'riesgos_electricos'
  | 'riesgos_mecanicos'
  | 'riesgos_quimicos'
  | 'ergonomia'
  | 'manipulacion_cargas'
  | 'riesgos_psicosociales'
  | 'incendios'
  | 'emergencias_evacuacion'
  | 'primeros_auxilios'
  | 'investigacion_accidentes'
  | 'medidas_preventivas';

export type TileType =
  | 'salida'
  | 'pregunta'
  | 'peligro'
  | 'epi'
  | 'senalizacion'
  | 'accidente'
  | 'desafio'
  | 'prevencion'
  | 'emergencia'
  | 'investigacion'
  | 'especial'
  | 'meta';

export type IndustrialZone =
  | 'fabrica'
  | 'almacen'
  | 'taller'
  | 'oficina'
  | 'construccion'
  | 'laboratorio'
  | 'hospital'
  | 'cocina'
  | 'carga'
  | 'control'
  | 'electrica'
  | 'emergencias';

export type Difficulty = 'facil' | 'intermedio' | 'avanzado';

export type WrongAnswerPenalty = 0 | 1 | 2;

export type QuestionType =
  | 'test'
  | 'true_false'
  | 'visual_id'
  | 'epi_select'
  | 'ordering'
  | 'practical_case'
  | 'accident_investigation'
  | 'team_challenge';

export type TeamColorId = 'azul' | 'naranja' | 'verde' | 'morado' | 'rojo';

export type TeamRole =
  | 'coordinador'
  | 'lector'
  | 'analista'
  | 'portavoz'
  | 'decisor';

export type BadgeId =
  | 'experto_epi'
  | 'maestro_senalizacion'
  | 'detective_riesgos'
  | 'especialista_emergencias'
  | 'experto_ergonomia'
  | 'investigador_accidentes'
  | 'heroe_prevencion';

export type CameraViewMode =
  | 'isometric'
  | 'path_close'
  | 'active_tile'
  | 'dice'
  | 'teams'
  | 'goal';

export type GraphicsQuality = 'baja' | 'media' | 'alta' | 'ultra';

export interface TileDefinition {
  index: number; // 1 to 48
  name: string;
  subtitle: string;
  type: TileType;
  category: PRLCategory;
  zone: IndustrialZone;
  position: [number, number, number]; // 3D world coordinates [x, y, z]
  color: string;
  accentColor: string;
  icon3D: string;
  specialEffect?: {
    moveDelta?: number; // +N oca-style advance or -N safe inspection retreat
    targetTile?: number;
    bonusPoints?: number;
    skipTurn?: boolean;
    extraRoll?: boolean;
    explanation: string;
  };
  challengeId?: string;
}

export interface QuestionItem {
  id: string;
  title: string;
  prompt: string;
  category: PRLCategory;
  difficulty: Difficulty;
  type: QuestionType;
  options: string[];
  /**
   * Stable per-option identifiers matching the current order of `options`.
   * Generated server-side on presentation so client submissions validate by ID rather than position.
   */
  optionIds?: string[];
  /**
   * For standard single-choice ('test', 'true_false', 'visual_id', 'practical_case', 'accident_investigation', 'team_challenge'):
   * array with single index e.g. [1].
   * For 'epi_select': array of all required option indices sorted e.g. [0, 2, 3].
   * For 'ordering': sequence of option indices in the right order e.g. [2, 0, 1, 3].
   * Stripped to [] in client payloads until `ActiveTurnChallenge.answered === true`.
   */
  correctIndices: number[];
  /**
   * Stable canonical identifiers of correct options (stripped from un-answered client payloads).
   */
  correctOptionIds?: string[];
  explanation: {
    whyCorrect: string;
    riskIdentified: string;
    consequences: string;
    preventiveMeasures: string;
    legalReference: string;
  };
  points: number;
  timeSeconds: number;
  collection?: string;
  active: boolean;
  visualSceneHint?: string;
}

export interface ChallengeHotspot3D {
  id: string;
  label: string;
  description: string;
  position: [number, number, number];
  isCorrect: boolean;
  feedback: string;
}

export interface Challenge3DDefinition {
  id: string;
  number: number; // 1 to 8
  title: string;
  subtitle: string;
  category: PRLCategory;
  zone: IndustrialZone;
  sceneType:
    | 'taller_peligros'
    | 'vestir_epi'
    | 'evacuacion_edificio'
    | 'extincion_incendio'
    | 'orden_almacen'
    | 'panel_electrico'
    | 'estacion_ergonomica'
    | 'investigacion_accidente';
  instructions: string;
  timeSeconds: number;
  points: number;
  requiredSelections: number;
  hotspots: ChallengeHotspot3D[];
  pedagogicalSummary: string;
  legalReference: string;
}

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;
  color: string;
  iconShape: 'helmet' | 'sign' | 'magnifier' | 'siren' | 'chair' | 'clipboard' | 'shield';
  unlockConditionText: string;
  relatedCategories: PRLCategory[];
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  connected: boolean;
  ready: boolean;
  isTeacher?: boolean;
  isSpectator?: boolean;
  participatesAsPlayer?: boolean;
  joinedAt: number;
}

export interface RoomParticipantStats {
  registeredCount: number;
  connectedCount: number;
  disconnectedCount: number;
  teacherConnected: boolean;
  teachersCount: number;
  spectatorsConnected: number;
  maxPlayers: number;
}

export interface RoleAssignment {
  playerId: string;
  playerName: string;
  roles: TeamRole[];
}

export interface Team {
  id: string;
  name: string;
  colorId: TeamColorId;
  hexColor: string;
  position: number; // Tile index 1..48
  previousPosition: number;
  score: number;
  streak: number;
  bestStreak: number;
  badges: BadgeId[];
  correctAnswers: number;
  wrongAnswers: number;
  challengesCompleted: number;
  skipNextTurn: boolean;
  roleRotationOffset: number;
  currentRoles: RoleAssignment[];
  finishOrder?: number;
  finishedAt?: number;
}

export interface GoalCelebrationEvent {
  teamId: string;
  teamName: string;
  teamColor: string;
  playerName: string;
  finishOrder: number;
  allFinished: boolean;
  timestamp: number;
}

export interface GameConfig {
  roomName: string;
  mode: 'teams' | 'individual';
  teamCount: number; // 2 to 5 in teams mode, or 2 to 15 in individual mode
  maxPlayers: number; // 2 to 15
  diceMode: '1d6' | '2d6';
  difficultyFilter: Difficulty | 'todas';
  wrongAnswerPenalty: WrongAnswerPenalty;
  allowLateJoin?: boolean;
  enabledCategories: PRLCategory[];
  timers: {
    facil: number;
    intermedio: number;
    avanzado: number;
    desafio: number;
  };
  scoring: {
    facil: number;
    intermedio: number;
    avanzado: number;
    desafio: number;
    investigacion: number;
    colaboracionBonus: number;
  };
}

export interface ActiveTurnChallenge {
  kind: 'question' | 'challenge3d';
  question?: QuestionItem;
  challenge3d?: Challenge3DDefinition;
  tileIndex: number;
  teamId: string;
  startedAt: number;
  expiresAt: number;
  answered: boolean;
  selectedOptionIds?: string[];
  selectedIndices?: number[];
  isCorrect?: boolean;
  pointsAwarded?: number;
  retreatTiles?: number;
  collaborationBonusAwarded?: boolean;
  unlockedBadges?: BadgeId[];
}

export interface DiceRollResult {
  dice: number[]; // [d1] or [d1, d2]
  total: number;
  rolledByPlayerId: string;
  rolledByTeamId: string;
  fromTile: number;
  toTile: number;
  specialRedirectTile?: number;
  specialExplanation?: string;
  timestamp: number;
}

export interface CategoryStat {
  category: PRLCategory;
  correct: number;
  wrong: number;
  totalTimeMs: number;
}

export interface GameLogEvent {
  id: string;
  timestamp: number;
  type: 'system' | 'dice' | 'move' | 'answer' | 'challenge' | 'badge' | 'special' | 'teacher';
  teamId?: string;
  message: string;
}

export type RoomStatus = 'lobby' | 'playing' | 'paused' | 'finished' | 'closed';

export type RoomJoinErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CLOSED'
  | 'ROOM_FINISHED'
  | 'ROOM_FULL'
  | 'INVALID_ROOM_CODE'
  | 'ROOM_NOT_JOINABLE'
  | 'INVALID_TEACHER_PIN'
  | 'TEACHER_AUTH_REQUIRED'
  | 'INVALID_PLAYER_TOKEN'
  | 'UNAUTHORIZED_PLAYER'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_KICKED'
  | 'NOT_YOUR_TURN'
  | 'JOIN_REJECTED';

export interface GameRoomState {
  roomCode: string;
  status: RoomStatus;
  config: GameConfig;
  players: Player[];
  kickedPlayerIds?: string[];
  teams: Team[];
  activeTeamIndex: number;
  activePlayerId?: string | null;
  turnNumber: number;
  phase: 'waiting_roll' | 'moving' | 'answering' | 'showing_feedback' | 'finished';
  lastDiceRoll: DiceRollResult | null;
  activeChallenge: ActiveTurnChallenge | null;
  winnerTeamId: string | null;
  finishedTeamIds?: string[];
  lastGoalCelebration?: GoalCelebrationEvent | null;
  categoryStats: Record<PRLCategory, CategoryStat>;
  logs: GameLogEvent[];
  usedQuestionIds: string[];
  createdAt: number;
  startedAt?: number;
  updatedAt: number;
}

export interface MatchHistoryRecord {
  id: string;
  roomCode: string;
  roomName: string;
  finishedAt: number;
  mode: 'teams' | 'individual';
  winnerTeamName: string;
  winnerColor: string;
  winnerScore: number;
  totalTurns: number;
  totalQuestions: number;
  overallAccuracy: number;
  teamsSummary: Array<{
    name: string;
    color: string;
    score: number;
    position: number;
    correctAnswers: number;
    wrongAnswers: number;
    badges: BadgeId[];
    finishOrder?: number;
  }>;
  masteredCategories: PRLCategory[];
  reinforceCategories: PRLCategory[];
}

// ============================================================================
// WebSocket Protocol Messages
// ============================================================================

export type ClientToServerMessage =
  | {
      type: 'JOIN_ROOM';
      actionId: string;
      playerId: string;
      playerName: string;
      preferredTeamId?: string;
      isTeacher?: boolean;
      isSpectator?: boolean;
      participatesAsPlayer?: boolean;
      teacherPin?: string;
      teacherToken?: string;
      playerToken?: string;
    }
  | {
      type: 'TOGGLE_READY';
      actionId: string;
      playerId: string;
      playerToken?: string;
    }
  | {
      type: 'SELECT_TEAM';
      actionId: string;
      playerId: string;
      teamId: string;
      playerToken?: string;
    }
  | {
      type: 'ROLL_DICE';
      actionId: string;
      playerId: string;
      playerToken?: string;
    }
  | {
      type: 'SUBMIT_ANSWER';
      actionId: string;
      playerId: string;
      selectedOptionIds?: string[];
      selectedIndices?: number[];
      collaborated?: boolean;
      playerToken?: string;
    }
  | {
      type: 'COMPLETE_CHALLENGE_3D';
      actionId: string;
      playerId: string;
      selectedHotspotIds: string[];
      playerToken?: string;
    }
  | {
      type: 'NEXT_TURN';
      actionId: string;
      playerId: string;
      playerToken?: string;
    }
  | {
      type: 'TEACHER_ACTION';
      actionId: string;
      teacherToken: string;
      command:
        | { kind: 'START_GAME' }
        | { kind: 'PAUSE_GAME' }
        | { kind: 'RESUME_GAME' }
        | { kind: 'END_GAME' }
        | { kind: 'CLOSE_ROOM' }
        | { kind: 'FORCE_NEXT_TURN' }
        | { kind: 'ASSIGN_TEAM'; playerId: string; teamId: string }
        | { kind: 'RENAME_PLAYER'; playerId: string; newName: string }
        | { kind: 'KICK_PLAYER'; playerId: string }
        | { kind: 'MOVE_TEAM'; teamId: string; targetTile: number }
        | { kind: 'ADJUST_SCORE'; teamId: string; delta: number }
        | { kind: 'SKIP_QUESTION' }
        | { kind: 'REPEAT_QUESTION' }
        | { kind: 'FORCE_QUESTION'; questionId: string }
        | { kind: 'FORCE_CHALLENGE'; challengeId: string }
        | { kind: 'UPDATE_CONFIG'; partialConfig: Partial<GameConfig> };
    }
  | {
      type: 'PING';
      timestamp: number;
    };

export type ServerToClientMessage =
  | {
      type: 'STATE_SYNC';
      state: GameRoomState;
      yourPlayerId?: string;
      teacherToken?: string;
      playerToken?: string;
    }
  | {
      type: 'GAME_STARTED';
      roomCode: string;
      startedAt: number;
      state: GameRoomState;
    }
  | {
      type: 'DICE_ROLLED';
      roll: DiceRollResult;
      state: GameRoomState;
    }
  | {
      type: 'ANSWER_RESULT';
      isCorrect: boolean;
      pointsAwarded: number;
      unlockedBadges: BadgeId[];
      state: GameRoomState;
    }
  | {
      type: 'ERROR';
      code: string;
      message: string;
      state?: GameRoomState;
    }
  | {
      type: 'PONG';
      timestamp: number;
    };
