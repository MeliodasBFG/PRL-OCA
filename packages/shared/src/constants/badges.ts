import {
  BadgeDefinition,
  GameConfig,
  IndustrialZone,
  PRLCategory,
  TeamColorId,
  TeamRole,
  TileType,
} from '../types/game';

export const ALL_PRL_CATEGORIES: PRLCategory[] = [
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
];

export const PRL_CATEGORY_LABELS: Record<PRLCategory, string> = {
  conceptos_basicos: '1. Conceptos Básicos de PRL',
  identificacion_peligros: '2. Identificación de Peligros',
  evaluacion_riesgos: '3. Evaluación de Riesgos',
  senalizacion: '4. Señalización de Seguridad',
  epi: '5. Equipos de Protección Individual (EPI)',
  riesgos_electricos: '6. Riesgos Eléctricos',
  riesgos_mecanicos: '7. Riesgos Mecánicos',
  riesgos_quimicos: '8. Riesgos Químicos y Biológicos',
  ergonomia: '9. Ergonomía y PVD',
  manipulacion_cargas: '10. Manipulación Manual de Cargas',
  riesgos_psicosociales: '11. Riesgos Psicosociales',
  incendios: '12. Prevención y Extinción de Incendios',
  emergencias_evacuacion: '13. Emergencias y Evacuación',
  primeros_auxilios: '14. Primeros Auxilios (PAS)',
  investigacion_accidentes: '15. Investigación de Accidentes',
  medidas_preventivas: '16. Medidas Preventivas y Colectivas',
};

export const INDUSTRIAL_ZONE_LABELS: Record<IndustrialZone, string> = {
  fabrica: 'Fábrica Industrial',
  almacen: 'Almacén Logístico',
  taller: 'Taller Mecánico',
  oficina: 'Oficinas Corporativas',
  construccion: 'Zona de Construcción',
  laboratorio: 'Laboratorio Químico',
  hospital: 'Centro Sanitario / Hospital',
  cocina: 'Cocina Industrial',
  carga: 'Muelle de Carga y Descarga',
  control: 'Sala de Control Central',
  electrica: 'Subestación Eléctrica',
  emergencias: 'Base de Emergencias y Meta',
};

export const TILE_TYPE_LABELS: Record<TileType, string> = {
  salida: 'Salida Segura',
  pregunta: 'Pregunta PRL',
  peligro: 'Detección de Peligro',
  epi: 'Selección de EPI',
  senalizacion: 'Señalización',
  accidente: 'Caso de Accidente',
  desafio: 'Desafío 3D Interactivo',
  prevencion: 'Oca Preventiva (Buena Práctica)',
  emergencia: 'Alerta de Emergencia',
  investigacion: 'Investigación Técnica',
  especial: 'Inspección / Punto de Control',
  meta: 'Meta Cero Accidentes',
};

export const TEAM_PRESETS: Array<{
  colorId: TeamColorId;
  name: string;
  hexColor: string;
  secondaryHex: string;
}> = [
  {
    colorId: 'azul',
    name: 'Equipo Azul (Ingeniería Segura)',
    hexColor: '#0284C7',
    secondaryHex: '#38BDF8',
  },
  {
    colorId: 'naranja',
    name: 'Equipo Naranja (Brigada Alerta)',
    hexColor: '#EA580C',
    secondaryHex: '#FB923C',
  },
  {
    colorId: 'verde',
    name: 'Equipo Verde (Escuadrón Cero Riesgo)',
    hexColor: '#10B981',
    secondaryHex: '#34D399',
  },
  {
    colorId: 'morado',
    name: 'Equipo Morado (Vigilancia Ergonómica)',
    hexColor: '#7C3AED',
    secondaryHex: '#A78BFA',
  },
  {
    colorId: 'rojo',
    name: 'Equipo Rojo (Intervención y Rescate)',
    hexColor: '#E11D48',
    secondaryHex: '#FB7185',
  },
];

export const TEAM_ROLES_ORDER: TeamRole[] = [
  'coordinador',
  'lector',
  'analista',
  'portavoz',
  'decisor',
];

export const TEAM_ROLE_INFO: Record<
  TeamRole,
  { title: string; shortDesc: string; icon: string }
> = {
  coordinador: {
    title: 'Coordinador/a de Turno',
    shortDesc: 'Organiza el debate del equipo y controla el tiempo disponible.',
    icon: 'Compass',
  },
  lector: {
    title: 'Lector/a de la Situación',
    shortDesc: 'Lee en voz alta el enunciado, contexto y opciones preventivas.',
    icon: 'BookOpen',
  },
  analista: {
    title: 'Analista del Riesgo',
    shortDesc: 'Identifica los peligros, causas y normativa aplicable.',
    icon: 'SearchCheck',
  },
  portavoz: {
    title: 'Portavoz Preventivo',
    shortDesc: 'Sintetiza los argumentos del grupo y expone la conclusión.',
    icon: 'Megaphone',
  },
  decisor: {
    title: 'Responsable de Decisión',
    shortDesc: 'Ejecuta el lanzamiento de dados y confirma la respuesta final.',
    icon: 'CheckCircle',
  },
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'experto_epi',
    name: 'Experto en EPI',
    description: 'Domina la selección y uso correcto de Equipos de Protección Individual (RD 773/1997).',
    color: '#0284C7',
    iconShape: 'helmet',
    unlockConditionText: 'Superar un reto o pregunta de EPI sin fallos.',
    relatedCategories: ['epi', 'riesgos_quimicos'],
  },
  {
    id: 'maestro_senalizacion',
    name: 'Maestro de la Señalización',
    description: 'Reconoce al instante paneles de prohibición, obligación, advertencia, socorro y lucha contra incendios (RD 485/1997).',
    color: '#F59E0B',
    iconShape: 'sign',
    unlockConditionText: 'Acertar pruebas de Señalización de Seguridad.',
    relatedCategories: ['senalizacion'],
  },
  {
    id: 'detective_riesgos',
    name: 'Detective de Riesgos',
    description: 'Localiza peligros ocultos en maquinaria, talleres, almacenes e instalaciones eléctricas.',
    color: '#EA580C',
    iconShape: 'magnifier',
    unlockConditionText: 'Superar pruebas de Identificación de Peligros, Mecánicos o Eléctricos.',
    relatedCategories: ['identificacion_peligros', 'riesgos_mecanicos', 'riesgos_electricos', 'evaluacion_riesgos'],
  },
  {
    id: 'especialista_emergencias',
    name: 'Especialista en Emergencias',
    description: 'Actúa con eficacia ante incendios, evacuaciones y protocolo PAS de primeros auxilios.',
    color: '#EF4444',
    iconShape: 'siren',
    unlockConditionText: 'Superar retos de Incendios, Emergencias o Primeros Auxilios.',
    relatedCategories: ['incendios', 'emergencias_evacuacion', 'primeros_auxilios'],
  },
  {
    id: 'experto_ergonomia',
    name: 'Experto en Ergonomía y Bienestar',
    description: 'Optimiza puestos de trabajo, manipulación de cargas y factores psicosociales.',
    color: '#8B5CF6',
    iconShape: 'chair',
    unlockConditionText: 'Acertar retos de Ergonomía, Cargas o Riesgos Psicosociales.',
    relatedCategories: ['ergonomia', 'manipulacion_cargas', 'riesgos_psicosociales'],
  },
  {
    id: 'investigador_accidentes',
    name: 'Investigador de Accidentes',
    description: 'Distingue causas inmediatas y básicas para implantar medidas correctoras definitivas.',
    color: '#06B6D4',
    iconShape: 'clipboard',
    unlockConditionText: 'Resolver un caso de Investigación de Accidentes.',
    relatedCategories: ['investigacion_accidentes'],
  },
  {
    id: 'heroe_prevencion',
    name: 'Héroe de la Prevención',
    description: 'Mantiene una racha de 3 o más actuaciones preventivas impecables seguidas.',
    color: '#10B981',
    iconShape: 'shield',
    unlockConditionText: 'Alcanzar una racha de 3 aciertos consecutivos o 120+ puntos.',
    relatedCategories: ['conceptos_basicos', 'medidas_preventivas'],
  },
];

export const DEFAULT_GAME_CONFIG: GameConfig = {
  roomName: 'Formación PRL - Sala Industrial 3D',
  mode: 'teams',
  teamCount: 3,
  maxPlayers: 15,
  diceMode: '1d6',
  difficultyFilter: 'todas',
  wrongAnswerPenalty: 0,
  enabledCategories: [...ALL_PRL_CATEGORIES],
  timers: {
    facil: 30,
    intermedio: 45,
    avanzado: 60,
    desafio: 120,
  },
  scoring: {
    facil: 10,
    intermedio: 20,
    avanzado: 30,
    desafio: 40,
    investigacion: 50,
    colaboracionBonus: 10,
  },
};
