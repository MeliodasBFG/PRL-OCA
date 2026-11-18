import {
  ALL_PRL_CATEGORIES,
  BADGE_DEFINITIONS,
  DEFAULT_GAME_CONFIG,
  TEAM_PRESETS,
  TEAM_ROLES_ORDER,
} from '../constants/badges';
import { BOARD_TILES } from '../constants/board';
import { CHALLENGES_3D } from '../constants/challenges';
import { INITIAL_QUESTION_BANK } from '../constants/questions';
import {
  BadgeId,
  CategoryStat,
  DiceRollResult,
  GameConfig,
  GameLogEvent,
  GameRoomState,
  MatchHistoryRecord,
  Player,
  PRLCategory,
  QuestionItem,
  RoleAssignment,
  Team,
  TeamRole,
} from '../types/game';

function createLog(
  type: GameLogEvent['type'],
  message: string,
  teamId?: string
): GameLogEvent {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    type,
    teamId,
    message,
  };
}

export function createInitialCategoryStats(): Record<PRLCategory, CategoryStat> {
  const stats = {} as Record<PRLCategory, CategoryStat>;
  for (const cat of ALL_PRL_CATEGORIES) {
    stats[cat] = {
      category: cat,
      correct: 0,
      wrong: 0,
      totalTimeMs: 0,
    };
  }
  return stats;
}

export function buildTeamsForConfig(config: GameConfig): Team[] {
  const count =
    config.mode === 'individual'
      ? Math.max(2, Math.min(15, config.maxPlayers))
      : Math.max(2, Math.min(5, config.teamCount));

  const teams: Team[] = [];
  for (let i = 0; i < count; i++) {
    const preset = TEAM_PRESETS[i % TEAM_PRESETS.length];
    const teamName =
      config.mode === 'individual'
        ? `Participante ${i + 1}`
        : count <= 5
        ? preset.name
        : `Equipo ${i + 1}`;
    teams.push({
      id: `team_${i + 1}`,
      name: teamName,
      colorId: preset.colorId,
      hexColor: preset.hexColor,
      position: 1,
      previousPosition: 1,
      score: 0,
      streak: 0,
      bestStreak: 0,
      badges: [],
      correctAnswers: 0,
      wrongAnswers: 0,
      challengesCompleted: 0,
      skipNextTurn: false,
      roleRotationOffset: 0,
      currentRoles: [],
    });
  }
  return teams;
}

export function computeRolesForTeam(team: Team, allPlayers: Player[]): RoleAssignment[] {
  const members = allPlayers.filter(
    (p) => p.teamId === team.id && !p.isTeacher && !p.isSpectator
  );
  if (members.length === 0) {
    return [];
  }

  const assignmentsMap = new Map<string, RoleAssignment>();
  for (const m of members) {
    assignmentsMap.set(m.id, {
      playerId: m.id,
      playerName: m.name,
      roles: [],
    });
  }

  // Distribute all 5 roles across the available team members rotating each turn
  for (let rIdx = 0; rIdx < TEAM_ROLES_ORDER.length; rIdx++) {
    const role: TeamRole = TEAM_ROLES_ORDER[rIdx];
    const memberIndex = (rIdx + team.roleRotationOffset) % members.length;
    const targetMember = members[memberIndex];
    const entry = assignmentsMap.get(targetMember.id);
    if (entry) {
      entry.roles.push(role);
    }
  }

  return Array.from(assignmentsMap.values());
}

export function refreshAllTeamRoles(state: GameRoomState): void {
  for (const team of state.teams) {
    team.currentRoles = computeRolesForTeam(team, state.players);
    if (state.config.mode === 'individual') {
      const owner = state.players.find((p) => p.teamId === team.id && !p.isTeacher && !p.isSpectator);
      if (owner) {
        team.name = owner.name;
      }
    }
  }
}

export function createInitialRoomState(
  roomCode: string,
  partialConfig?: Partial<GameConfig>
): GameRoomState {
  const config: GameConfig = {
    ...DEFAULT_GAME_CONFIG,
    ...partialConfig,
    timers: {
      ...DEFAULT_GAME_CONFIG.timers,
      ...(partialConfig?.timers ?? {}),
    },
    scoring: {
      ...DEFAULT_GAME_CONFIG.scoring,
      ...(partialConfig?.scoring ?? {}),
    },
    enabledCategories:
      partialConfig?.enabledCategories && partialConfig.enabledCategories.length > 0
        ? partialConfig.enabledCategories
        : [...ALL_PRL_CATEGORIES],
  };

  const now = Date.now();
  return {
    roomCode: roomCode.toUpperCase(),
    status: 'lobby',
    config,
    players: [],
    teams: buildTeamsForConfig(config),
    activeTeamIndex: 0,
    turnNumber: 1,
    phase: 'waiting_roll',
    lastDiceRoll: null,
    activeChallenge: null,
    winnerTeamId: null,
    categoryStats: createInitialCategoryStats(),
    logs: [
      createLog(
        'system',
        `Sala ${roomCode.toUpperCase()} creada. Configuración: ${
          config.mode === 'teams' ? `${config.teamCount} equipos` : 'Modo individual'
        } (máx. ${config.maxPlayers} participantes).`
      ),
    ],
    usedQuestionIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function joinPlayerToState(
  state: GameRoomState,
  params: {
    playerId: string;
    playerName: string;
    preferredTeamId?: string;
    isTeacher?: boolean;
    isSpectator?: boolean;
  }
): { ok: boolean; error?: string; player?: Player } {
  const existing = state.players.find((p) => p.id === params.playerId);
  if (existing) {
    existing.connected = true;
    existing.name = params.playerName.trim() || existing.name;
    if (params.isTeacher !== undefined) existing.isTeacher = params.isTeacher;
    if (params.isSpectator !== undefined) existing.isSpectator = params.isSpectator;
    refreshAllTeamRoles(state);
    state.updatedAt = Date.now();
    return { ok: true, player: existing };
  }

  const activeParticipants = state.players.filter((p) => !p.isTeacher && !p.isSpectator);
  if (!params.isTeacher && !params.isSpectator && activeParticipants.length >= state.config.maxPlayers) {
    return {
      ok: false,
      error: `La sala ha alcanzado el límite configurado de ${state.config.maxPlayers} participantes.`,
    };
  }

  // Pick balanced team if not specified or invalid
  let assignedTeamId = 'spectator';
  if (!params.isTeacher && !params.isSpectator) {
    const validPreferred = state.teams.find((t) => t.id === params.preferredTeamId);
    if (validPreferred) {
      assignedTeamId = validPreferred.id;
    } else {
      // Assign to the team with the fewest players
      let minCount = Infinity;
      let chosen = state.teams[0]?.id ?? 'team_1';
      for (const team of state.teams) {
        const count = activeParticipants.filter((p) => p.teamId === team.id).length;
        if (count < minCount) {
          minCount = count;
          chosen = team.id;
        }
      }
      assignedTeamId = chosen;
    }
  }

  const newPlayer: Player = {
    id: params.playerId,
    name: params.playerName.trim(),
    teamId: assignedTeamId,
    connected: true,
    ready: true,
    isTeacher: Boolean(params.isTeacher),
    isSpectator: Boolean(params.isSpectator),
    joinedAt: Date.now(),
  };

  state.players.push(newPlayer);
  refreshAllTeamRoles(state);
  state.logs.unshift(
    createLog(
      'system',
      params.isTeacher
        ? `El docente ${newPlayer.name} se ha conectado al panel de control.`
        : params.isSpectator
        ? `Modo proyección/espectador (${newPlayer.name}) conectado.`
        : `${newPlayer.name} se ha unido al ${
            state.teams.find((t) => t.id === assignedTeamId)?.name ?? assignedTeamId
          }.`,
      assignedTeamId
    )
  );
  state.logs = state.logs.slice(0, 60);
  state.updatedAt = Date.now();
  return { ok: true, player: newPlayer };
}

export function selectQuestionForTile(
  state: GameRoomState,
  tileIndex: number,
  customBank?: QuestionItem[]
): QuestionItem {
  const tile = BOARD_TILES.find((t) => t.index === tileIndex) ?? BOARD_TILES[1];
  const bank = (customBank && customBank.length > 0 ? customBank : INITIAL_QUESTION_BANK).filter(
    (q) => q.active
  );

  // Filter by difficulty if teacher configured a specific difficulty
  const diffFiltered =
    state.config.difficultyFilter === 'todas'
      ? bank
      : bank.filter((q) => q.difficulty === state.config.difficultyFilter);
  const pool = diffFiltered.length > 0 ? diffFiltered : bank;

  // Prefer matching tile category & unused
  let candidates = pool.filter(
    (q) => q.category === tile.category && !state.usedQuestionIds.includes(q.id)
  );

  // If all in category used, allow any unused in enabled categories
  if (candidates.length === 0) {
    candidates = pool.filter(
      (q) =>
        state.config.enabledCategories.includes(q.category) &&
        !state.usedQuestionIds.includes(q.id)
    );
  }

  // If all used, reset used history for category
  if (candidates.length === 0) {
    candidates = pool.filter((q) => q.category === tile.category);
  }
  if (candidates.length === 0) {
    candidates = pool;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)] ?? INITIAL_QUESTION_BANK[0];
  if (!state.usedQuestionIds.includes(chosen.id)) {
    state.usedQuestionIds.push(chosen.id);
  }

  // Apply teacher's configured timer and points
  const timeSeconds = state.config.timers[chosen.difficulty] ?? chosen.timeSeconds;
  const points =
    chosen.type === 'accident_investigation'
      ? state.config.scoring.investigacion
      : state.config.scoring[chosen.difficulty] ?? chosen.points;

  return {
    ...chosen,
    timeSeconds,
    points,
  };
}

export function secureRandomDie(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return (arr[0] % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

export function rollDiceServerSide(
  state: GameRoomState,
  playerId: string,
  customBank?: QuestionItem[],
  customDieGenerator: () => number = secureRandomDie
): { ok: boolean; error?: string; roll?: DiceRollResult } {
  if (state.status !== 'playing') {
    return { ok: false, error: 'La partida no está en curso.' };
  }
  if (state.phase !== 'waiting_roll') {
    return { ok: false, error: 'No es el momento de lanzar los dados.' };
  }

  const activeTeam = state.teams[state.activeTeamIndex];
  if (!activeTeam) {
    return { ok: false, error: 'No hay equipo activo seleccionado.' };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { ok: false, error: 'Jugador no reconocido en la sala.' };
  }
  if (!player.isTeacher && player.teamId !== activeTeam.id) {
    return { ok: false, error: `Es el turno del ${activeTeam.name}.` };
  }

  const diceCount = state.config.diceMode === '2d6' ? 2 : 1;
  const dice: number[] = [];
  for (let i = 0; i < diceCount; i++) {
    dice.push(customDieGenerator());
  }
  const total = dice.reduce((acc, v) => acc + v, 0);

  const fromTile = activeTeam.position;
  let rawTarget = fromTile + total;
  // Classic Oca bounce back if exceeding 48, or land on 48
  if (rawTarget > 48) {
    const overflow = rawTarget - 48;
    rawTarget = Math.max(1, 48 - overflow);
  }

  activeTeam.previousPosition = fromTile;
  activeTeam.position = rawTarget;

  const landedTile = BOARD_TILES.find((t) => t.index === rawTarget) ?? BOARD_TILES[0];
  let specialRedirectTile: number | undefined;
  let specialExplanation: string | undefined;

  // Handle special tile / Oca Preventiva effects
  if (landedTile.specialEffect) {
    specialExplanation = landedTile.specialEffect.explanation;
    if (landedTile.specialEffect.bonusPoints) {
      activeTeam.score = Math.max(0, activeTeam.score + landedTile.specialEffect.bonusPoints);
    }
    if (landedTile.specialEffect.targetTile) {
      specialRedirectTile = landedTile.specialEffect.targetTile;
      activeTeam.position = specialRedirectTile;
    } else if (landedTile.specialEffect.moveDelta) {
      specialRedirectTile = Math.max(1, Math.min(48, rawTarget + landedTile.specialEffect.moveDelta));
      activeTeam.position = specialRedirectTile;
    }
  }

  const finalTileIndex = activeTeam.position;
  const finalTile = BOARD_TILES.find((t) => t.index === finalTileIndex) ?? landedTile;

  const rollResult: DiceRollResult = {
    dice,
    total,
    rolledByPlayerId: playerId,
    rolledByTeamId: activeTeam.id,
    fromTile,
    toTile: rawTarget,
    specialRedirectTile,
    specialExplanation,
    timestamp: Date.now(),
  };

  state.lastDiceRoll = rollResult;

  state.logs.unshift(
    createLog(
      'dice',
      `${activeTeam.name} lanzó ${dice.join(' + ')} (${total}) y avanzó de la casilla ${fromTile} a la ${finalTileIndex} (${finalTile.name}).`,
      activeTeam.id
    )
  );

  // Check if reached Meta (Tile 48) -> Final validation question or direct win
  if (finalTileIndex === 48) {
    const finalQuestion = selectQuestionForTile(state, 48, customBank);
    const now = Date.now();
    state.activeChallenge = {
      kind: 'question',
      question: finalQuestion,
      tileIndex: 48,
      teamId: activeTeam.id,
      startedAt: now,
      expiresAt: now + finalQuestion.timeSeconds * 1000,
      answered: false,
    };
    state.phase = 'answering';
    state.updatedAt = now;
    return { ok: true, roll: rollResult };
  }

  // If landed on an Oca Preventiva or Especial tile that already triggered an explanation,
  // still present a quick challenge/question OR if it's an Oca Preventiva with extraRoll, show feedback
  if (landedTile.type === 'prevencion' || landedTile.type === 'especial') {
    state.logs.unshift(createLog('special', landedTile.specialEffect?.explanation ?? landedTile.subtitle, activeTeam.id));
    state.activeChallenge = null;
    state.phase = 'showing_feedback';
    state.updatedAt = Date.now();
    return { ok: true, roll: rollResult };
  }

  // Check if the final tile is a 3D interactive challenge
  if (finalTile.type === 'desafio' && finalTile.challengeId) {
    const challenge3d =
      CHALLENGES_3D.find((c) => c.id === finalTile.challengeId) ?? CHALLENGES_3D[0];
    const now = Date.now();
    const duration = state.config.timers.desafio ?? challenge3d.timeSeconds;
    state.activeChallenge = {
      kind: 'challenge3d',
      challenge3d: {
        ...challenge3d,
        timeSeconds: duration,
        points: state.config.scoring.desafio ?? challenge3d.points,
      },
      tileIndex: finalTileIndex,
      teamId: activeTeam.id,
      startedAt: now,
      expiresAt: now + duration * 1000,
      answered: false,
    };
    state.phase = 'answering';
    state.updatedAt = now;
    return { ok: true, roll: rollResult };
  }

  // Otherwise present a question for the tile's PRL category
  const question = selectQuestionForTile(state, finalTileIndex, customBank);
  const now = Date.now();
  state.activeChallenge = {
    kind: 'question',
    question,
    tileIndex: finalTileIndex,
    teamId: activeTeam.id,
    startedAt: now,
    expiresAt: now + question.timeSeconds * 1000,
    answered: false,
  };
  state.phase = 'answering';
  state.updatedAt = now;
  return { ok: true, roll: rollResult };
}

function checkAndUnlockBadges(team: Team, category: PRLCategory): BadgeId[] {
  const newlyUnlocked: BadgeId[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (team.badges.includes(badge.id)) continue;

    if (badge.id === 'heroe_prevencion') {
      if (team.streak >= 3 || team.score >= 120) {
        team.badges.push(badge.id);
        newlyUnlocked.push(badge.id);
      }
    } else if (badge.relatedCategories.includes(category)) {
      team.badges.push(badge.id);
      newlyUnlocked.push(badge.id);
    }
  }

  return newlyUnlocked;
}

export function submitAnswerServerSide(
  state: GameRoomState,
  playerId: string,
  selectedIndices: number[],
  collaborated = true
): {
  ok: boolean;
  error?: string;
  isCorrect?: boolean;
  pointsAwarded?: number;
  unlockedBadges?: BadgeId[];
} {
  if (state.status !== 'playing' || state.phase !== 'answering' || !state.activeChallenge) {
    return { ok: false, error: 'No hay ninguna pregunta activa para responder.' };
  }
  if (state.activeChallenge.kind !== 'question' || !state.activeChallenge.question) {
    return { ok: false, error: 'El reto actual es un desafío 3D interactivo.' };
  }
  if (state.activeChallenge.answered) {
    return { ok: false, error: 'Esta pregunta ya ha sido respondida.' };
  }

  const activeTeam = state.teams[state.activeTeamIndex];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { ok: false, error: 'Jugador no encontrado.' };
  }
  if (!player.isTeacher && player.teamId !== activeTeam.id) {
    return { ok: false, error: `Solo el ${activeTeam.name} puede responder en su turno.` };
  }

  const q = state.activeChallenge.question;
  let isCorrect = false;

  if (q.type === 'ordering') {
    isCorrect =
      selectedIndices.length === q.correctIndices.length &&
      selectedIndices.every((val, idx) => val === q.correctIndices[idx]);
  } else if (q.type === 'epi_select') {
    const sortedSel = [...selectedIndices].sort((a, b) => a - b);
    const sortedCor = [...q.correctIndices].sort((a, b) => a - b);
    isCorrect =
      sortedSel.length === sortedCor.length &&
      sortedSel.every((val, idx) => val === sortedCor[idx]);
  } else {
    isCorrect = selectedIndices.length > 0 && selectedIndices[0] === q.correctIndices[0];
  }

  const elapsedMs = Math.max(500, Date.now() - state.activeChallenge.startedAt);
  const catStat = state.categoryStats[q.category];
  if (catStat) {
    catStat.totalTimeMs += elapsedMs;
    if (isCorrect) catStat.correct += 1;
    else catStat.wrong += 1;
  }

  let pointsAwarded = 0;
  let unlockedBadges: BadgeId[] = [];
  const teamMembersCount = state.players.filter(
    (p) => p.teamId === activeTeam.id && !p.isTeacher && !p.isSpectator
  ).length;
  const giveCollabBonus = collaborated && teamMembersCount > 1;

  if (isCorrect) {
    pointsAwarded = q.points + (giveCollabBonus ? state.config.scoring.colaboracionBonus : 0);
    activeTeam.score += pointsAwarded;
    activeTeam.correctAnswers += 1;
    activeTeam.streak += 1;
    if (activeTeam.streak > activeTeam.bestStreak) {
      activeTeam.bestStreak = activeTeam.streak;
    }
    unlockedBadges = checkAndUnlockBadges(activeTeam, q.category);

    state.logs.unshift(
      createLog(
        'answer',
        `¡Respuesta correcta de ${activeTeam.name}! +${pointsAwarded} puntos (${q.title}).`,
        activeTeam.id
      )
    );

    if (unlockedBadges.length > 0) {
      const badgeNames = unlockedBadges
        .map((bId) => BADGE_DEFINITIONS.find((b) => b.id === bId)?.name ?? bId)
        .join(', ');
      state.logs.unshift(
        createLog('badge', `🏅 ¡${activeTeam.name} ha desbloqueado la insignia: ${badgeNames}!`, activeTeam.id)
      );
    }

    // Check if team answered on Meta Tile 48 -> Victory!
    if (activeTeam.position === 48) {
      state.winnerTeamId = activeTeam.id;
      state.status = 'finished';
      state.phase = 'finished';
      state.logs.unshift(
        createLog(
          'system',
          `🏆 ¡VICTORIA PREVENTIVA! ${activeTeam.name} ha alcanzado la Meta Cero Accidentes con ${activeTeam.score} puntos.`,
          activeTeam.id
        )
      );
    }
  } else {
    activeTeam.wrongAnswers += 1;
    activeTeam.streak = 0;
    // If on tile 48 and failed the final question, step back to tile 46 to reinforce
    if (activeTeam.position === 48) {
      activeTeam.position = 46;
    }
    state.logs.unshift(
      createLog(
        'answer',
        `Respuesta incorrecta de ${activeTeam.name} en "${q.title}". Se muestra explicación pedagógica.`,
        activeTeam.id
      )
    );
  }

  state.activeChallenge.answered = true;
  state.activeChallenge.selectedIndices = selectedIndices;
  state.activeChallenge.isCorrect = isCorrect;
  state.activeChallenge.pointsAwarded = pointsAwarded;
  state.activeChallenge.collaborationBonusAwarded = isCorrect && giveCollabBonus;
  state.activeChallenge.unlockedBadges = unlockedBadges;

  if (state.status !== 'finished') {
    state.phase = 'showing_feedback';
  }
  state.updatedAt = Date.now();

  return {
    ok: true,
    isCorrect,
    pointsAwarded,
    unlockedBadges,
  };
}

export function completeChallenge3DServerSide(
  state: GameRoomState,
  playerId: string,
  selectedHotspotIds: string[]
): {
  ok: boolean;
  error?: string;
  isCorrect?: boolean;
  pointsAwarded?: number;
  unlockedBadges?: BadgeId[];
} {
  if (state.status !== 'playing' || state.phase !== 'answering' || !state.activeChallenge) {
    return { ok: false, error: 'No hay ningún desafío 3D activo.' };
  }
  if (state.activeChallenge.kind !== 'challenge3d' || !state.activeChallenge.challenge3d) {
    return { ok: false, error: 'El reto actual no es un desafío 3D.' };
  }
  if (state.activeChallenge.answered) {
    return { ok: false, error: 'Este desafío 3D ya ha sido completado.' };
  }

  const activeTeam = state.teams[state.activeTeamIndex];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { ok: false, error: 'Jugador no encontrado.' };
  }
  if (!player.isTeacher && player.teamId !== activeTeam.id) {
    return { ok: false, error: `Solo el ${activeTeam.name} puede resolver este desafío.` };
  }

  const challenge = state.activeChallenge.challenge3d;
  const correctIds = challenge.hotspots.filter((h) => h.isCorrect).map((h) => h.id);
  const uniqueSelected = Array.from(new Set(selectedHotspotIds));

  const hits = uniqueSelected.filter((id) => correctIds.includes(id)).length;
  const falsePositives = uniqueSelected.filter((id) => !correctIds.includes(id)).length;
  const isCorrect = hits === correctIds.length && falsePositives === 0;

  const elapsedMs = Math.max(1000, Date.now() - state.activeChallenge.startedAt);
  const catStat = state.categoryStats[challenge.category];
  if (catStat) {
    catStat.totalTimeMs += elapsedMs;
    if (isCorrect) catStat.correct += 1;
    else catStat.wrong += 1;
  }

  let pointsAwarded = 0;
  let unlockedBadges: BadgeId[] = [];

  if (isCorrect) {
    pointsAwarded = challenge.points + state.config.scoring.colaboracionBonus;
    activeTeam.score += pointsAwarded;
    activeTeam.challengesCompleted += 1;
    activeTeam.correctAnswers += 1;
    activeTeam.streak += 1;
    if (activeTeam.streak > activeTeam.bestStreak) {
      activeTeam.bestStreak = activeTeam.streak;
    }
    unlockedBadges = checkAndUnlockBadges(activeTeam, challenge.category);

    state.logs.unshift(
      createLog(
        'challenge',
        `🌟 ¡Desafío 3D "${challenge.title}" superado por ${activeTeam.name}! +${pointsAwarded} puntos.`,
        activeTeam.id
      )
    );
  } else {
    // Award partial points if they found at least 2 hazards without false positives
    if (hits >= 2 && falsePositives <= 1) {
      pointsAwarded = Math.round(challenge.points * 0.4);
      activeTeam.score += pointsAwarded;
    }
    activeTeam.wrongAnswers += 1;
    activeTeam.streak = 0;
    state.logs.unshift(
      createLog(
        'challenge',
        `Desafío 3D "${challenge.title}" finalizado por ${activeTeam.name} (${hits}/${correctIds.length} aciertos).`,
        activeTeam.id
      )
    );
  }

  state.activeChallenge.answered = true;
  state.activeChallenge.isCorrect = isCorrect;
  state.activeChallenge.pointsAwarded = pointsAwarded;
  state.activeChallenge.unlockedBadges = unlockedBadges;
  state.phase = 'showing_feedback';
  state.updatedAt = Date.now();

  return {
    ok: true,
    isCorrect,
    pointsAwarded,
    unlockedBadges,
  };
}

export function advanceTurnServerSide(state: GameRoomState): void {
  if (state.status === 'finished') return;

  const currentTeam = state.teams[state.activeTeamIndex];
  const landedTileIndex = state.lastDiceRoll?.toTile;
  const landedTile = BOARD_TILES.find((t) => t.index === landedTileIndex);

  // Check if current team earned an extra roll from an Oca Preventiva
  const hasExtraRoll = Boolean(landedTile?.specialEffect?.extraRoll);

  if (hasExtraRoll && currentTeam) {
    currentTeam.roleRotationOffset += 1;
    refreshAllTeamRoles(state);
    state.phase = 'waiting_roll';
    state.activeChallenge = null;
    state.logs.unshift(
      createLog(
        'turn' as GameLogEvent['type'],
        `¡Tirada extra preventiva para ${currentTeam.name}! Los roles internos rotan para la nueva tirada.`,
        currentTeam.id
      )
    );
    state.updatedAt = Date.now();
    return;
  }

  if (currentTeam) {
    currentTeam.roleRotationOffset += 1;
  }

  // Move to next team
  const teamCount = state.teams.length;
  state.activeTeamIndex = (state.activeTeamIndex + 1) % teamCount;
  if (state.activeTeamIndex === 0) {
    state.turnNumber += 1;
  }

  refreshAllTeamRoles(state);
  state.phase = 'waiting_roll';
  state.activeChallenge = null;
  const nextTeam = state.teams[state.activeTeamIndex];
  if (nextTeam) {
    state.logs.unshift(
      createLog(
        'system',
        `Turno #${state.turnNumber}: le toca al ${nextTeam.name} (Casilla ${nextTeam.position}).`,
        nextTeam.id
      )
    );
  }
  state.updatedAt = Date.now();
}

export function buildMatchHistoryFromState(state: GameRoomState): MatchHistoryRecord {
  const sortedTeams = [...state.teams].sort((a, b) => {
    if (b.position !== a.position) return b.position - a.position;
    return b.score - a.score;
  });
  const winner =
    state.teams.find((t) => t.id === state.winnerTeamId) ?? sortedTeams[0] ?? state.teams[0];

  let totalQuestions = 0;
  let totalCorrect = 0;
  const masteredCategories: PRLCategory[] = [];
  const reinforceCategories: PRLCategory[] = [];

  for (const cat of ALL_PRL_CATEGORIES) {
    const st = state.categoryStats[cat];
    if (!st) continue;
    const attempts = st.correct + st.wrong;
    totalQuestions += attempts;
    totalCorrect += st.correct;
    if (attempts > 0) {
      const ratio = st.correct / attempts;
      if (ratio >= 0.7) masteredCategories.push(cat);
      else reinforceCategories.push(cat);
    }
  }

  const overallAccuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 100;

  return {
    id: `match_${state.roomCode}_${Date.now()}`,
    roomCode: state.roomCode,
    roomName: state.config.roomName,
    finishedAt: Date.now(),
    mode: state.config.mode,
    winnerTeamName: winner?.name ?? 'Equipo Azul',
    winnerColor: winner?.hexColor ?? '#0284C7',
    winnerScore: winner?.score ?? 0,
    totalTurns: state.turnNumber,
    totalQuestions,
    overallAccuracy,
    teamsSummary: sortedTeams.map((t) => ({
      name: t.name,
      color: t.hexColor,
      score: t.score,
      position: t.position,
      correctAnswers: t.correctAnswers,
      wrongAnswers: t.wrongAnswers,
      badges: t.badges,
    })),
    masteredCategories,
    reinforceCategories,
  };
}

export function executeTeacherCommandServerSide(
  state: GameRoomState,
  command: {
    kind: string;
    playerId?: string;
    teamId?: string;
    newName?: string;
    targetTile?: number;
    delta?: number;
    questionId?: string;
    partialConfig?: Partial<GameConfig>;
  },
  customBank?: QuestionItem[]
): { ok: boolean; error?: string } {
  const now = Date.now();

  switch (command.kind) {
    case 'START_GAME': {
      state.status = 'playing';
      state.phase = 'waiting_roll';
      refreshAllTeamRoles(state);
      state.logs.unshift(
        createLog('teacher', '¡El docente ha iniciado la partida en el tablero 3D!')
      );
      break;
    }
    case 'PAUSE_GAME': {
      if (state.status === 'playing') {
        state.status = 'paused';
        state.logs.unshift(createLog('teacher', 'Partida pausada por el docente.'));
      }
      break;
    }
    case 'RESUME_GAME': {
      if (state.status === 'paused') {
        state.status = 'playing';
        state.logs.unshift(createLog('teacher', 'Partida reanudada por el docente.'));
      }
      break;
    }
    case 'END_GAME': {
      state.status = 'finished';
      state.phase = 'finished';
      const sorted = [...state.teams].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.position - a.position;
      });
      state.winnerTeamId = sorted[0]?.id ?? null;
      state.logs.unshift(
        createLog(
          'teacher',
          `Partida finalizada por el docente. Equipo líder: ${sorted[0]?.name ?? 'N/A'}.`
        )
      );
      break;
    }
    case 'FORCE_NEXT_TURN': {
      state.lastDiceRoll = null;
      advanceTurnServerSide(state);
      state.logs.unshift(createLog('teacher', 'El docente ha avanzado manualmente al siguiente turno.'));
      break;
    }
    case 'ASSIGN_TEAM': {
      const player = state.players.find((p) => p.id === command.playerId);
      const team = state.teams.find((t) => t.id === command.teamId);
      if (player && team) {
        player.teamId = team.id;
        refreshAllTeamRoles(state);
        state.logs.unshift(
          createLog('teacher', `Docente asignó a ${player.name} al ${team.name}.`, team.id)
        );
      }
      break;
    }
    case 'RENAME_PLAYER': {
      const player = state.players.find((p) => p.id === command.playerId);
      if (player && command.newName) {
        const oldName = player.name;
        player.name = command.newName.trim();
        refreshAllTeamRoles(state);
        state.logs.unshift(
          createLog('teacher', `Docente renombró a "${oldName}" como "${player.name}".`)
        );
      }
      break;
    }
    case 'KICK_PLAYER': {
      const idx = state.players.findIndex((p) => p.id === command.playerId);
      if (idx !== -1) {
        const removed = state.players.splice(idx, 1)[0];
        refreshAllTeamRoles(state);
        state.logs.unshift(
          createLog('teacher', `Docente retiró al participante ${removed.name} de la sala.`)
        );
      }
      break;
    }
    case 'MOVE_TEAM': {
      const team = state.teams.find((t) => t.id === command.teamId);
      if (team && typeof command.targetTile === 'number') {
        team.previousPosition = team.position;
        team.position = Math.max(1, Math.min(48, command.targetTile));
        state.logs.unshift(
          createLog(
            'teacher',
            `Docente desplazó la ficha de ${team.name} a la casilla ${team.position}.`,
            team.id
          )
        );
      }
      break;
    }
    case 'ADJUST_SCORE': {
      const team = state.teams.find((t) => t.id === command.teamId);
      if (team && typeof command.delta === 'number') {
        team.score = Math.max(0, team.score + command.delta);
        state.logs.unshift(
          createLog(
            'teacher',
            `Docente ajustó puntuación de ${team.name} (${command.delta >= 0 ? '+' : ''}${
              command.delta
            } pts).`,
            team.id
          )
        );
      }
      break;
    }
    case 'SKIP_QUESTION': {
      const activeTeam = state.teams[state.activeTeamIndex];
      const q = selectQuestionForTile(state, activeTeam?.position ?? 2, customBank);
      state.activeChallenge = {
        kind: 'question',
        question: q,
        tileIndex: activeTeam?.position ?? 2,
        teamId: activeTeam?.id ?? 'team_1',
        startedAt: now,
        expiresAt: now + q.timeSeconds * 1000,
        answered: false,
      };
      state.phase = 'answering';
      state.logs.unshift(createLog('teacher', 'El docente cambió la pregunta activa por otra nueva.'));
      break;
    }
    case 'REPEAT_QUESTION': {
      if (state.activeChallenge) {
        const duration =
          state.activeChallenge.kind === 'question'
            ? state.activeChallenge.question?.timeSeconds ?? 45
            : state.activeChallenge.challenge3d?.timeSeconds ?? 90;
        state.activeChallenge.answered = false;
        state.activeChallenge.selectedIndices = undefined;
        state.activeChallenge.isCorrect = undefined;
        state.activeChallenge.startedAt = now;
        state.activeChallenge.expiresAt = now + duration * 1000;
        state.phase = 'answering';
        state.logs.unshift(createLog('teacher', 'El docente reinició la pregunta/reto actual.'));
      }
      break;
    }
    case 'FORCE_QUESTION': {
      const bank = customBank && customBank.length > 0 ? customBank : INITIAL_QUESTION_BANK;
      const found = bank.find((q) => q.id === command.questionId);
      const activeTeam = state.teams[state.activeTeamIndex];
      if (found && activeTeam) {
        state.activeChallenge = {
          kind: 'question',
          question: found,
          tileIndex: activeTeam.position,
          teamId: activeTeam.id,
          startedAt: now,
          expiresAt: now + found.timeSeconds * 1000,
          answered: false,
        };
        state.phase = 'answering';
        state.logs.unshift(
          createLog('teacher', `El docente lanzó manualmente la pregunta: "${found.title}".`)
        );
      }
      break;
    }
    case 'UPDATE_CONFIG': {
      if (command.partialConfig) {
        const prevTeamCount = state.config.teamCount;
        const prevMode = state.config.mode;
        state.config = {
          ...state.config,
          ...command.partialConfig,
          timers: {
            ...state.config.timers,
            ...(command.partialConfig.timers ?? {}),
          },
          scoring: {
            ...state.config.scoring,
            ...(command.partialConfig.scoring ?? {}),
          },
        };
        if (
          state.status === 'lobby' &&
          (command.partialConfig.teamCount !== prevTeamCount ||
            command.partialConfig.mode !== prevMode)
        ) {
          state.teams = buildTeamsForConfig(state.config);
          // Reassign players evenly across new teams
          const participants = state.players.filter((p) => !p.isTeacher && !p.isSpectator);
          participants.forEach((p, idx) => {
            p.teamId = state.teams[idx % state.teams.length]?.id ?? 'team_1';
          });
          refreshAllTeamRoles(state);
        }
        state.logs.unshift(
          createLog('teacher', 'El docente actualizó los parámetros de configuración de la partida.')
        );
      }
      break;
    }
    default:
      return { ok: false, error: 'Comando de docente desconocido.' };
  }

  state.updatedAt = now;
  return { ok: true };
}
