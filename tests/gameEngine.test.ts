import { describe, expect, it } from 'vitest';
import {
  ALL_PRL_CATEGORIES,
  BADGE_DEFINITIONS,
  BOARD_TILES,
  CHALLENGES_3D,
  INITIAL_QUESTION_BANK,
  advanceTurnServerSide,
  completeChallenge3DServerSide,
  createInitialRoomState,
  executeTeacherCommandServerSide,
  joinPlayerToState,
  rollDiceServerSide,
  submitAnswerServerSide,
} from '@prl-oca/shared';

describe('PRL-OCA 3D - Tablero de 48 Casillas, Contenidos y Motor Autoritativo', () => {
  it('verifica que el tablero tiene exactamente 48 casillas tridimensionales y 12 zonas', () => {
    expect(BOARD_TILES).toHaveLength(48);
    expect(BOARD_TILES[0].index).toBe(1);
    expect(BOARD_TILES[0].type).toBe('salida');
    expect(BOARD_TILES[47].index).toBe(48);
    expect(BOARD_TILES[47].type).toBe('meta');

    const zones = new Set(BOARD_TILES.map((t) => t.zone));
    expect(zones.size).toBe(12);
  });

  it('verifica las 16 categorías PRL, el banco inicial de 48 preguntas y los 8 desafíos 3D', () => {
    expect(ALL_PRL_CATEGORIES).toHaveLength(16);
    expect(INITIAL_QUESTION_BANK.length).toBeGreaterThanOrEqual(48);
    expect(CHALLENGES_3D).toHaveLength(8);
    expect(BADGE_DEFINITIONS).toHaveLength(7);

    for (const category of ALL_PRL_CATEGORIES) {
      const catQuestions = INITIAL_QUESTION_BANK.filter((q) => q.category === category);
      expect(catQuestions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('gestiona tiradas de dados autoritativas en servidor (1d6 y 2d6), Ocas Preventivas y puntuación', () => {
    const state = createInitialRoomState('TEST01', {
      mode: 'teams',
      teamCount: 3,
      maxPlayers: 15,
      diceMode: '1d6',
    });

    joinPlayerToState(state, { playerId: 'p1', playerName: 'Ana', preferredTeamId: 'team_1' });
    joinPlayerToState(state, { playerId: 'p2', playerName: 'Luis', preferredTeamId: 'team_1' });
    state.status = 'playing';

    // Roll a 1 -> moves from Tile 1 to Tile 2 (Pregunta Conceptos Básicos)
    const rollRes = rollDiceServerSide(state, 'p1', INITIAL_QUESTION_BANK, () => 1);
    expect(rollRes.ok).toBe(true);
    expect(rollRes.roll?.toTile).toBe(2);
    expect(state.teams[0].position).toBe(2);
    expect(state.phase).toBe('answering');
    expect(state.activeChallenge?.kind).toBe('question');

    // Submit correct answer -> awards points + collaboration bonus
    const q = state.activeChallenge!.question!;
    const ansRes = submitAnswerServerSide(state, 'p1', q.correctIndices, true);
    expect(ansRes.ok).toBe(true);
    expect(ansRes.isCorrect).toBe(true);
    expect(state.teams[0].score).toBe(q.points + state.config.scoring.colaboracionBonus);

    // Advance turn to Team 2
    advanceTurnServerSide(state);
    expect(state.activeTeamIndex).toBe(1);
  });

  it('valida los Desafíos 3D Interactivos y los comandos del Panel del Profesor', () => {
    const state = createInitialRoomState('TEST02');
    joinPlayerToState(state, { playerId: 'p1', playerName: 'Carlos', preferredTeamId: 'team_1' });
    executeTeacherCommandServerSide(state, { kind: 'START_GAME' });
    expect(state.status).toBe('playing');

    // Roll a 5 -> moves from Tile 1 to Tile 6 (Desafío 3D #5: Orden en el almacén)
    const rollRes = rollDiceServerSide(state, 'p1', INITIAL_QUESTION_BANK, () => 5);
    expect(rollRes.ok).toBe(true);
    expect(state.activeChallenge?.kind).toBe('challenge3d');

    const ch = state.activeChallenge!.challenge3d!;
    const correctHotspots = ch.hotspots.filter((h) => h.isCorrect).map((h) => h.id);
    const chRes = completeChallenge3DServerSide(state, 'p1', correctHotspots);
    expect(chRes.ok).toBe(true);
    expect(chRes.isCorrect).toBe(true);
    expect(state.teams[0].challengesCompleted).toBe(1);

    // Teacher moves team manually and adjusts score
    executeTeacherCommandServerSide(state, {
      kind: 'MOVE_TEAM',
      teamId: 'team_1',
      targetTile: 47,
    });
    expect(state.teams[0].position).toBe(47);

    executeTeacherCommandServerSide(state, {
      kind: 'ADJUST_SCORE',
      teamId: 'team_1',
      delta: 50,
    });
    expect(state.teams[0].score).toBeGreaterThanOrEqual(90);
  });
});
