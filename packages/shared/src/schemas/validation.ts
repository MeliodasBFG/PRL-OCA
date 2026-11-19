import { z } from 'zod';

export const PRLCategorySchema = z.enum([
  'conceptos_basicos',
  'identificacion_peligros',
  'evaluacion_riesgos',
  'senalizacion',
  'epi',
  'riesgos_electricos',
  'riesgos_mecanicos',
  'riesgos_quimicos',
  'ergonomia',
  'manipulacion_cargas',
  'riesgos_psicosociales',
  'incendios',
  'emergencias_evacuacion',
  'primeros_auxilios',
  'investigacion_accidentes',
  'medidas_preventivas',
]);

export const DifficultySchema = z.enum(['facil', 'intermedio', 'avanzado']);

export const QuestionTypeSchema = z.enum([
  'test',
  'true_false',
  'visual_id',
  'epi_select',
  'ordering',
  'practical_case',
  'accident_investigation',
  'team_challenge',
]);

export const QuestionItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3).max(160),
  prompt: z.string().min(10).max(1000),
  category: PRLCategorySchema,
  difficulty: DifficultySchema,
  type: QuestionTypeSchema,
  options: z.array(z.string().min(1)).min(2).max(8),
  correctIndices: z.array(z.number().int().min(0).max(7)).min(1),
  explanation: z.object({
    whyCorrect: z.string().min(5),
    riskIdentified: z.string().min(3),
    consequences: z.string().min(3),
    preventiveMeasures: z.string().min(3),
    legalReference: z.string().min(3),
  }),
  points: z.number().int().min(5).max(200),
  timeSeconds: z.number().int().min(10).max(300),
  collection: z.string().optional(),
  active: z.boolean().default(true),
  visualSceneHint: z.string().optional(),
});

export const GameConfigSchema = z.object({
  roomName: z.string().min(2).max(80).default('Formación PRL - Sala Principal'),
  mode: z.enum(['teams', 'individual']).default('teams'),
  teamCount: z.number().int().min(2).max(15).default(3),
  maxPlayers: z.number().int().min(2).max(15).default(15),
  diceMode: z.enum(['1d6', '2d6']).default('1d6'),
  difficultyFilter: z.enum(['facil', 'intermedio', 'avanzado', 'todas']).default('todas'),
  wrongAnswerPenalty: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
  enabledCategories: z.array(PRLCategorySchema).min(1),
  timers: z.object({
    facil: z.number().int().min(10).max(180).default(30),
    intermedio: z.number().int().min(10).max(180).default(45),
    avanzado: z.number().int().min(10).max(240).default(60),
    desafio: z.number().int().min(20).max(300).default(120),
  }),
  scoring: z.object({
    facil: z.number().int().min(5).max(100).default(10),
    intermedio: z.number().int().min(5).max(100).default(20),
    avanzado: z.number().int().min(5).max(150).default(30),
    desafio: z.number().int().min(10).max(200).default(40),
    investigacion: z.number().int().min(10).max(200).default(50),
    colaboracionBonus: z.number().int().min(0).max(50).default(10),
  }),
});

export const CreateRoomRequestSchema = z.object({
  config: GameConfigSchema.partial().optional(),
  teacherPin: z.string().min(4).max(32),
  teacherName: z.string().min(2).max(40).default('Docente PRL'),
});

export const TeacherCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('START_GAME') }),
  z.object({ kind: z.literal('PAUSE_GAME') }),
  z.object({ kind: z.literal('RESUME_GAME') }),
  z.object({ kind: z.literal('END_GAME') }),
  z.object({ kind: z.literal('FORCE_NEXT_TURN') }),
  z.object({
    kind: z.literal('ASSIGN_TEAM'),
    playerId: z.string().min(1),
    teamId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('RENAME_PLAYER'),
    playerId: z.string().min(1),
    newName: z.string().min(1).max(40),
  }),
  z.object({
    kind: z.literal('KICK_PLAYER'),
    playerId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('MOVE_TEAM'),
    teamId: z.string().min(1),
    targetTile: z.number().int().min(1).max(48),
  }),
  z.object({
    kind: z.literal('ADJUST_SCORE'),
    teamId: z.string().min(1),
    delta: z.number().int().min(-500).max(500),
  }),
  z.object({ kind: z.literal('SKIP_QUESTION') }),
  z.object({ kind: z.literal('REPEAT_QUESTION') }),
  z.object({
    kind: z.literal('FORCE_QUESTION'),
    questionId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('FORCE_CHALLENGE'),
    challengeId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('UPDATE_CONFIG'),
    partialConfig: GameConfigSchema.partial(),
  }),
]);

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('JOIN_ROOM'),
    actionId: z.string().min(1).max(64),
    playerId: z.string().min(1).max(64),
    playerName: z.string().min(1).max(40),
    preferredTeamId: z.string().optional(),
    isTeacher: z.boolean().optional(),
    isSpectator: z.boolean().optional(),
    teacherPin: z.string().optional(),
  }),
  z.object({
    type: z.literal('TOGGLE_READY'),
    actionId: z.string().min(1).max(64),
    playerId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal('SELECT_TEAM'),
    actionId: z.string().min(1).max(64),
    playerId: z.string().min(1).max(64),
    teamId: z.string().min(1).max(32),
  }),
  z.object({
    type: z.literal('ROLL_DICE'),
    actionId: z.string().min(1).max(64),
    playerId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal('SUBMIT_ANSWER'),
    actionId: z.string().min(1).max(64),
    playerId: z.string().min(1).max(64),
    selectedIndices: z.array(z.number().int().min(0).max(10)).min(1),
    collaborated: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('COMPLETE_CHALLENGE_3D'),
    actionId: z.string().min(1).max(64),
    playerId: z.string().min(1).max(64),
    selectedHotspotIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('NEXT_TURN'),
    actionId: z.string().min(1).max(64),
    playerId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal('TEACHER_ACTION'),
    actionId: z.string().min(1).max(64),
    teacherToken: z.string().min(1),
    command: TeacherCommandSchema,
  }),
  z.object({
    type: z.literal('PING'),
    timestamp: z.number(),
  }),
]);
