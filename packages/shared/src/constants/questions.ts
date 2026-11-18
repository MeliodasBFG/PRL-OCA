import { QuestionItem } from '../types/game';

export const INITIAL_QUESTION_BANK: QuestionItem[] = [
  // ==================== 1. CONCEPTOS BÁSICOS DE PRL ====================
  {
    id: 'q_cb_01',
    title: 'Derecho a la protección eficaz en el trabajo',
    prompt:
      'Según la Ley de Prevención de Riesgos Laborales, ¿quién tiene el deber legal de garantizar la seguridad y la salud de los trabajadores en todos los aspectos relacionados con el trabajo?',
    category: 'conceptos_basicos',
    difficulty: 'facil',
    type: 'test',
    options: [
      'El empresario o dirección de la empresa.',
      'Exclusivamente el propio trabajador mediante el uso de sus propios medios.',
      'Únicamente el fabricante de la maquinaria industrial.',
      'Solo la Inspección de Trabajo cuando realiza una visita.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El artículo 14 de la Ley 31/1995 establece que los trabajadores tienen derecho a una protección eficaz en materia de seguridad y salud, lo que supone un correlativo deber del empresario de protegerlos frente a los riesgos laborales.',
      riskIdentified: 'Desconocimiento de las responsabilidades preventivas y desprotección organizativa.',
      consequences: 'Ausencia de planificación preventiva, accidentes laborales y responsabilidades administrativas, civiles y penales.',
      preventiveMeasures: 'Integrar la prevención en el sistema general de gestión de la empresa en todos los niveles jerárquicos.',
      legalReference: 'Artículo 14 de la Ley 31/1995, de Prevención de Riesgos Laborales (LPRL).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Curso Básico PRL',
    active: true,
  },
  {
    id: 'q_cb_02',
    title: 'Coste de las medidas preventivas',
    prompt:
      'Verdadero o Falso: El coste de las medidas relativas a la seguridad y la salud en el trabajo (como los EPI o la vigilancia de la salud) puede descontarse parcialmente de la nómina del trabajador si este está de acuerdo.',
    category: 'conceptos_basicos',
    difficulty: 'facil',
    type: 'true_false',
    options: [
      'Verdadero: puede pactarse un copago voluntario.',
      'Falso: el coste de las medidas de seguridad y salud no deberá recaer en modo alguno sobre los trabajadores.',
    ],
    correctIndices: [1],
    explanation: {
      whyCorrect:
        'La Ley 31/1995 prohíbe expresamente trasladar cualquier coste de la acción preventiva, formación o equipos de protección a las personas trabajadoras.',
      riskIdentified: 'Barrera económica para el acceso a equipos seguros y vigilancia médica.',
      consequences: 'Trabajadores desprotegidos o con equipos deteriorados por no poder costear su reposición.',
      preventiveMeasures: 'Suministro gratuito por la empresa de EPI, formación en horario laboral y reconocimientos médicos.',
      legalReference: 'Artículo 14.5 de la Ley 31/1995, de Prevención de Riesgos Laborales.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Curso Básico PRL',
    active: true,
  },
  {
    id: 'q_cb_03',
    title: 'Principios de la Acción Preventiva',
    prompt:
      'Ordena correctamente la jerarquía de los principios de la acción preventiva que establece el artículo 15 de la Ley 31/1995, desde la primera prioridad hasta la última:',
    category: 'conceptos_basicos',
    difficulty: 'avanzado',
    type: 'ordering',
    options: [
      '1º Evitar los riesgos en su totalidad siempre que sea posible.',
      '2º Evaluar los riesgos que no se puedan evitar.',
      '3º Combatir los riesgos en su origen.',
      '4º Anteponer la protección colectiva a la individual (EPI).',
    ],
    correctIndices: [0, 1, 2, 3],
    explanation: {
      whyCorrect:
        'El artículo 15.1 LPRL fija una secuencia lógica obligatoria: primero eliminar el riesgo; si no es posible, evaluarlo, atacarlo en la fuente y priorizar siempre las medidas colectivas sobre las individuales.',
      riskIdentified: 'Abuso del EPI como primera medida sin intentar eliminar o aislar antes la fuente del peligro.',
      consequences: 'Persistencia del peligro ambiental en el centro de trabajo y dependencia exclusiva del factor humano.',
      preventiveMeasures: 'Aplicar rigurosamente el orden jerárquico del Art. 15 LPRL al diseñar cualquier puesto o proceso.',
      legalReference: 'Artículo 15.1 de la Ley 31/1995, de Prevención de Riesgos Laborales.',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Curso Básico PRL',
    active: true,
  },

  // ==================== 2. IDENTIFICACIÓN DE PELIGROS ====================
  {
    id: 'q_ip_01',
    title: 'Diferencia entre Peligro y Riesgo Laboral',
    prompt:
      'En terminología preventiva, ¿qué diferencia existe entre "peligro" (factor de riesgo) y "riesgo laboral"?',
    category: 'identificacion_peligros',
    difficulty: 'intermedio',
    type: 'test',
    options: [
      'Peligro es la fuente o situación con capacidad de producir daño, y riesgo es la combinación de la probabilidad de que se materialice y la severidad del daño.',
      'Son sinónimos exactos según la legislación española.',
      'Riesgo es únicamente cuando ya se ha producido una lesión con baja médica.',
      'Peligro solo aplica a sustancias químicas y riesgo solo a máquinas.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El peligro es la propiedad intrínseca de una instalación, equipo o sustancia para causar daño (ej. un suelo mojado o una escalera), mientras que el riesgo laboral mide la posibilidad de que un trabajador sufra un determinado daño derivado del trabajo (Art. 4.2 LPRL).',
      riskIdentified: 'Confusión conceptual al identificar fuentes de daño frente a su valoración.',
      consequences: 'Evaluaciones de riesgos incompletas que pasan por alto fuentes de daño latentes.',
      preventiveMeasures: 'Realizar inspecciones sistemáticas de seguridad para listar todos los peligros antes de estimar su probabilidad y severidad.',
      legalReference: 'Artículo 4.2 de la Ley 31/1995 (Definiciones de riesgo laboral y gravedad).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Curso Básico PRL',
    active: true,
  },
  {
    id: 'q_ip_02',
    title: 'Inspección Visual en Zona de Paso Industrial',
    prompt:
      'Observas un pasillo del almacén donde una manguera neumática cruza de lado a lado a ras de suelo y hay una luminaria fundida dejando el tramo en penumbra. ¿Qué riesgo principal se genera de forma inmediata?',
    category: 'identificacion_peligros',
    difficulty: 'facil',
    type: 'visual_id',
    visualSceneHint: 'Pasillo industrial con manguera cruzada y baja iluminación',
    options: [
      'Riesgo de caída al mismo nivel por tropiezo y falta de visibilidad adecuada.',
      'Riesgo de radiación ionizante.',
      'Riesgo biológico de grupo 4.',
      'Riesgo exclusivo de hipoacusia neurosensorial.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La presencia de conducciones o cables atravesando zonas de paso combinada con iluminación insuficiente es una de las causas más frecuentes de tropiezos y caídas al mismo nivel.',
      riskIdentified: 'Obstáculos en vías de circulación e iluminación deficiente.',
      consequences: 'Esguinces, contusiones, fracturas y golpes contra objetos o maquinaria adyacente.',
      preventiveMeasures: 'Canalizar mangueras mediante brazos aéreos retráctiles o pasacables biselados amarillo/negro y reponer de inmediato el nivel mínimo de lux exigido.',
      legalReference: 'RD 486/1997 (Anexo I sobre espacios de trabajo y Anexo IV sobre iluminación).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Curso Básico PRL',
    active: true,
  },
  {
    id: 'q_ip_03',
    title: 'Trabajos en Espacios Confinados',
    prompt:
      'Un equipo debe entrar a limpiar el interior de un depósito subterráneo con ventilación natural desfavorable. ¿Cuál es el peligro oculto más letal que debe medirse desde el exterior antes de acceder?',
    category: 'identificacion_peligros',
    difficulty: 'avanzado',
    type: 'practical_case',
    options: [
      'Atmósfera suboxigenada (asfixia por O2 < 19,5%), presencia de gases tóxicos (H2S, CO) o atmósfera explosiva (ATEX).',
      'Deslumbramiento solar directo en el fondo del tanque.',
      'Fatiga visual por uso de pantallas de visualización.',
      'Exposición a rayos ultravioleta de origen solar.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'En los espacios confinados se acumulan gases desplazantes de oxígeno, tóxicos o inflamables que no siempre se detectan por el olfato y provocan pérdida de consciencia en segundos.',
      riskIdentified: 'Asfixia, intoxicación aguda o explosión en recinto confinado.',
      consequences: 'Muerte por anoxia del operario y, frecuentemente, de compañeros que intentan rescatarlo sin equipo autónomo.',
      preventiveMeasures: 'Permiso de trabajo especial, medición continua multi-gas desde el exterior, ventilación forzada, arnés con trípode de rescate y presencia obligatoria de Recurso Preventivo.',
      legalReference: 'Artículo 32 bis de la Ley 31/1995 y RD 39/1997 (Art. 22 bis sobre presencia de recursos preventivos).',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Seguridad Industrial',
    active: true,
  },

  // ==================== 3. EVALUACIÓN DE RIESGOS ====================
  {
    id: 'q_er_01',
    title: 'Variables de la Matriz de Evaluación del INSST',
    prompt:
      'En el método general de evaluación de riesgos del Instituto Nacional de Seguridad y Salud en el Trabajo (INSST), ¿qué dos factores se cruzan para estimar la magnitud de un riesgo?',
    category: 'evaluacion_riesgos',
    difficulty: 'facil',
    type: 'test',
    options: [
      'La Probabilidad de que se produzca el daño (Baja, Media, Alta) y la Severidad o Consecuencias (Ligeramente dañino, Dañino, Extremadamente dañino).',
      'La antigüedad de la empresa y el salario medio de la plantilla.',
      'El precio de la máquina y los metros cuadrados de la nave.',
      'El número de extintores y el color de las paredes.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Para calificar un riesgo desde el punto de vista de su gravedad, el Art. 4.2 LPRL y la guía del INSST valoran conjuntamente la probabilidad de que se produzca el daño y la severidad del mismo.',
      riskIdentified: 'Falta de criterio objetivo para priorizar las inversiones y medidas preventivas.',
      consequences: 'Dejar sin corregir riesgos intolerables o importantes mientras se dedican recursos a riesgos triviales.',
      preventiveMeasures: 'Aplicar la matriz 3×3 (Probabilidad × Severidad) para clasificar los riesgos en Trivial, Tolerable, Moderado, Importante o Intolerable.',
      legalReference: 'Artículo 16.2.a de la Ley 31/1995 y Artículos 3 a 7 del RD 39/1997 (Reglamento de los Servicios de Prevención).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Gestión Preventiva',
    active: true,
  },
  {
    id: 'q_er_02',
    title: 'Actuación ante un Riesgo Intolerable (Riesgo Grave e Inminente)',
    prompt:
      'Si durante una evaluación o inspección se detecta un riesgo calificado como "Intolerable" (o riesgo grave e inminente), ¿qué acción debe tomarse?',
    category: 'evaluacion_riesgos',
    difficulty: 'intermedio',
    type: 'practical_case',
    options: [
      'No se debe comenzar ni continuar el trabajo hasta que se reduzca el riesgo; si no es posible reducirlo, debe prohibirse o paralizarse la actividad.',
      'Continuar trabajando con normalidad y anotarlo para la memoria anual del año siguiente.',
      'Esperar tres meses a que venza el contrato de mantenimiento.',
      'Pedir al trabajador que firme una renuncia voluntaria de responsabilidad.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Ante un riesgo intolerable o grave e inminente (Art. 21 LPRL), la prioridad absoluta es la vida e integridad física: el trabajo debe detenerse inmediatamente hasta controlar el riesgo.',
      riskIdentified: 'Exposición inminente a un daño muy grave o mortal.',
      consequences: 'Accidente mortal o muy grave e infracción muy grave con posible responsabilidad penal.',
      preventiveMeasures: 'Paralización inmediata de la tarea, evacuación de la zona de peligro y subsanación técnica verificada antes de reanudar.',
      legalReference: 'Artículo 21 de la Ley 31/1995 (Riesgo grave e inminente).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Gestión Preventiva',
    active: true,
  },
  {
    id: 'q_er_03',
    title: 'Cuándo debe revisarse la Evaluación de Riesgos',
    prompt:
      '¿En cuál de las siguientes situaciones es legalmente obligatorio revisar y actualizar la Evaluación de Riesgos de un puesto de trabajo?',
    category: 'evaluacion_riesgos',
    difficulty: 'intermedio',
    type: 'test',
    options: [
      'Cuando se introduzcan nuevos equipos, sustancias o tecnologías, cambien las condiciones de trabajo o se hayan producido daños a la salud de los trabajadores.',
      'Únicamente una vez cada 25 años.',
      'Solo cuando cambie el logotipo comercial de la empresa.',
      'Nunca; la evaluación inicial es definitiva para siempre.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La evaluación de riesgos es un proceso vivo y dinámico que debe actualizarse ante cualquier cambio técnico, organizativo o cuando aparezcan accidentes o enfermedades profesionales.',
      riskIdentified: 'Evaluación obsoleta que no contempla nuevas máquinas o procedimientos.',
      consequences: 'Riesgos emergentes no controlados ni informados a los trabajadores.',
      preventiveMeasures: 'Reevaluar el puesto ante la compra de maquinaria, modificación de procesos, incorporación de trabajadores especialmente sensibles o tras cualquier siniestro.',
      legalReference: 'Artículo 16.2.a de la Ley 31/1995 y Artículo 6 del RD 39/1997.',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Gestión Preventiva',
    active: true,
  },

  // ==================== 4. SEÑALIZACIÓN DE SEGURIDAD ====================
  {
    id: 'q_ss_01',
    title: 'Forma y color de las señales de Obligación',
    prompt:
      'Según el Real Decreto 485/1997 sobre señalización de seguridad y salud en el trabajo, ¿cómo son las señales de OBLIGACIÓN (por ejemplo, uso obligatorio de casco o gafas)?',
    category: 'senalizacion',
    difficulty: 'facil',
    type: 'visual_id',
    visualSceneHint: 'Panel circular azul con pictograma blanco de casco',
    options: [
      'Forma redonda, con pictograma blanco sobre fondo azul (el azul debe cubrir al menos el 50% de la superficie).',
      'Forma triangular, con pictograma negro sobre fondo amarillo y bordes negros.',
      'Forma rectangular o cuadrada, con pictograma blanco sobre fondo verde.',
      'Forma redonda, con pictograma negro sobre fondo blanco y borde y banda transversal rojos.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El Anexo III del RD 485/1997 define las señales de obligación con geometría circular, fondo azul de seguridad y símbolo blanco en el centro.',
      riskIdentified: 'Confusión en la interpretación de normas de comportamiento obligatorio al acceder a una zona.',
      consequences: 'Acceso a áreas industriales sin los equipos de protección requeridos.',
      preventiveMeasures: 'Instalar paneles normalizados a una altura y posición visibles en los accesos a las zonas de riesgo.',
      legalReference: 'RD 485/1997, Anexo III (Señales en forma de panel).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Señalización',
    active: true,
  },
  {
    id: 'q_ss_02',
    title: 'Identificación de Señales de Advertencia vs. Socorro',
    prompt:
      'En una nave ves dos paneles: uno es triangular con fondo amarillo y borde negro; el otro es rectangular con fondo verde y pictograma blanco. ¿Qué significan respectivamente?',
    category: 'senalizacion',
    difficulty: 'facil',
    type: 'test',
    options: [
      'El triangular amarillo es de Advertencia de peligro y el rectangular verde es de Salvamento o Socorro (vías de evacuación, botiquín, ducha de emergencia).',
      'Ambos indican prohibición de paso.',
      'El amarillo indica equipos contra incendios y el verde indica riesgo biológico.',
      'El amarillo indica salida de emergencia y el verde indica obligación de usar guantes.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El triángulo amarillo con borde negro advierte de un peligro o riesgo (eléctrico, caída, materias inflamables), mientras que el rectángulo/cuadrado verde identifica salvamento, primeros auxilios y vías de evacuación.',
      riskIdentified: 'Interpretación errónea de advertencias de peligro o rutas de evacuación.',
      consequences: 'Retrasos críticos durante una emergencia o exposición involuntaria a zonas de peligro.',
      preventiveMeasures: 'Formar a toda la plantilla en el código de formas y colores del RD 485/1997 y mantener los paneles limpios y fotoluminiscentes.',
      legalReference: 'RD 485/1997, Anexo II (Colores de seguridad) y Anexo III.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Señalización',
    active: true,
  },
  {
    id: 'q_ss_03',
    title: 'Alcance de la Señalización de Seguridad',
    prompt:
      'Verdadero o Falso: La colocación correcta de señales de advertencia en una máquina peligrosa sustituye la obligación de instalar resguardos físicos o medidas técnicas de protección.',
    category: 'senalizacion',
    difficulty: 'intermedio',
    type: 'true_false',
    options: [
      'Verdadero: si el cartel se ve claramente, ya no hace falta poner carcasa protectora.',
      'Falso: la señalización nunca sustituye a las medidas técnicas y organizativas de protección colectiva; es una medida complementaria.',
    ],
    correctIndices: [1],
    explanation: {
      whyCorrect:
        'La señalización informa o advierte del riesgo residual, pero por sí sola no elimina el peligro físico ni impide el contacto con un órgano móvil.',
      riskIdentified: 'Falsa sensación de seguridad al confiar únicamente en carteles informativos.',
      consequences: 'Atrapamientos, amputaciones o caídas a pesar de existir un cartel de aviso.',
      preventiveMeasures: 'Implantar primero protecciones técnicas y colectivas, utilizando la señalización como refuerzo informativo del riesgo residual.',
      legalReference: 'Artículo 4.1 del RD 485/1997 sobre criterios para el empleo de la señalización.',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Señalización',
    active: true,
  },

  // ==================== 5. EQUIPOS DE PROTECCIÓN INDIVIDUAL (EPI) ====================
  {
    id: 'q_epi_01',
    title: 'Selección de EPI para Esmerilado y Corte Metálico',
    prompt:
      'Un operario va a utilizar una amoladora radial para repasar cordones de soldadura que generan proyección de partículas incandescentes, alto nivel de ruido (>88 dB) y bordes cortantes. Selecciona TODOS los EPI necesarios:',
    category: 'epi',
    difficulty: 'intermedio',
    type: 'epi_select',
    options: [
      'Gafas integrales / pantalla facial contra impactos de alta velocidad (EN 166).',
      'Protectores auditivos (orejeras o tapones certificados EN 352).',
      'Guantes de protección mecánica y térmica (EN 388 / EN 407) y calzado de seguridad.',
      'Chanclas abiertas de goma para ventilar el pie.',
    ],
    correctIndices: [0, 1, 2],
    explanation: {
      whyCorrect:
        'El uso de amoladora combina proyección de esquirlas metálicas a gran velocidad (protección ocular/facial), ruido superior al nivel de acción de 85 dB(A) (protección auditiva) y riesgo mecánico/térmico en manos y pies.',
      riskIdentified: 'Impactos oculares por partículas, hipoacusia por ruido y cortes o quemaduras.',
      consequences: 'Lesiones corneales graves, pérdida auditiva irreversible y heridas inciso-contusas.',
      preventiveMeasures: 'Verificar el disco antes de montar, mantener el resguardo regulado y utilizar el conjunto completo de EPI con marcado CE.',
      legalReference: 'RD 773/1997 (Uso de EPI), RD 286/2006 (Ruido) y Reglamento (UE) 2016/425.',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Equipos de Protección',
    active: true,
  },
  {
    id: 'q_epi_02',
    title: 'Categorías de EPI según la gravedad del riesgo',
    prompt:
      'Según el Reglamento (UE) 2016/425 sobre EPI, ¿en qué categoría se clasifican los equipos destinados a proteger contra riesgos de consecuencias mortales o irreversibles (como arneses anticaídas, equipos de protección respiratoria filtrantes o guantes dieléctricos)?',
    category: 'epi',
    difficulty: 'avanzado',
    type: 'test',
    options: [
      'Categoría III (riesgos muy graves, mortales o daños irreversibles para la salud).',
      'Categoría I (riesgos mínimos superficiales).',
      'Categoría 0 (sin necesidad de marcado CE).',
      'Equipos de confort doméstico.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Los EPI de Categoría III protegen frente a peligros mortales o que pueden dañar de forma grave e irreversible la salud; su marcado CE va acompañado del número de 4 dígitos del organismo notificado que controla su producción.',
      riskIdentified: 'Uso de equipos de protección inadecuados para riesgos críticos de altura, asfixia o alta tensión.',
      consequences: 'Fallo catastrófico del equipo con resultado de muerte o incapacidad permanente.',
      preventiveMeasures: 'Exigir EPI de Categoría III certificados, revisar su fecha de caducidad e inspeccionarlos antes de cada uso.',
      legalReference: 'Reglamento (UE) 2016/425 relativo a los EPI y RD 773/1997.',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Equipos de Protección',
    active: true,
  },
  {
    id: 'q_epi_03',
    title: 'Conservación y uso del EPI por el trabajador',
    prompt:
      '¿Qué debe hacer un trabajador si al ir a colocarse su arnés anticaídas observa que una de las costuras de carga está deshilachada o presenta cortes?',
    category: 'epi',
    difficulty: 'facil',
    type: 'practical_case',
    options: [
      'No utilizarlo bajo ningún concepto, retirarlo de servicio e informar de inmediato a su superior jerárquico directo para su sustitución.',
      'Coserlo en casa con hilo normal o pegarlo con cinta adhesiva industrial.',
      'Usarlo igualmente si el trabajo va a durar menos de diez minutos.',
      'Prestárselo a un compañero que pese menos kilos.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El artículo 10 del RD 773/1997 y el Art. 29 LPRL obligan al trabajador a cuidar los EPI y a informar de inmediato a su superior de cualquier defecto, anomalía o daño que pueda entrañar una pérdida de su eficacia protectora.',
      riskIdentified: 'Rotura del sistema anticaídas ante una solicitación dinámica.',
      consequences: 'Caída libre desde altura con consecuencias mortales.',
      preventiveMeasures: 'Inspección visual pre-uso diaria, retirada inmediata de equipos dañados o que hayan detenido una caída y revisión periódica anual por persona competente.',
      legalReference: 'Artículo 10 del RD 773/1997 y Artículo 29.2.2º de la Ley 31/1995.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Equipos de Protección',
    active: true,
  },

  // ==================== 6. RIESGOS ELÉCTRICOS ====================
  {
    id: 'q_re_01',
    title: 'Las 5 Reglas de Oro para trabajar sin tensión',
    prompt:
      'Ordena secuencialmente las 5 Reglas de Oro establecidas en el Anexo II del RD 614/2001 para garantizar la supresión de la tensión antes de trabajar en una instalación eléctrica:',
    category: 'riesgos_electricos',
    difficulty: 'avanzado',
    type: 'ordering',
    options: [
      '1º Desconectar (corte efectivo de todas las fuentes de tensión).',
      '2º Prevenir cualquier posible realimentación (enclavamiento o bloqueo LOTO y señalización).',
      '3º Verificar la ausencia de tensión en todos los elementos activos.',
      '4º Poner a tierra y en cortocircuito (y 5º Proteger frente a elementos próximos en tensión).',
    ],
    correctIndices: [0, 1, 2, 3],
    explanation: {
      whyCorrect:
        'Las 5 Reglas de Oro deben aplicarse siempre en este orden estricto para garantizar que la instalación está y permanecerá sin tensión durante toda la intervención.',
      riskIdentified: 'Electrocución o arco eléctrico por tensión residual o reconexión accidental.',
      consequences: 'Fibrilación ventricular, parada cardiorrespiratoria, quemaduras graves por arco o muerte.',
      preventiveMeasures: 'Cumplir las 5 Reglas de Oro sin saltar ningún paso y emplear verificadores de tensión y equipos de puesta a tierra certificados.',
      legalReference: 'RD 614/2001, Anexo II.A.1 (Supresión de la tensión).',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Riesgo Eléctrico',
    active: true,
  },
  {
    id: 'q_re_02',
    title: 'Protección frente a Contactos Eléctricos Indirectos',
    prompt:
      '¿Qué combinación de medidas técnicas es la más habitual y eficaz para proteger a las personas frente a contactos eléctricos indirectos (masas metálicas puestas accidentalmente en tensión por un fallo de aislamiento)?',
    category: 'riesgos_electricos',
    difficulty: 'intermedio',
    type: 'test',
    options: [
      'La puesta a tierra de las masas metálicas combinada con un dispositivo de corte automático como el interruptor diferencial.',
      'Pintar la carcasa de la máquina de color azul.',
      'Colocar únicamente un fusible de muy alto amperaje.',
      'Mojar el suelo alrededor de la máquina para enfriarla.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La toma de tierra deriva la corriente de defecto hacia el terreno y hace saltar automáticamente el interruptor diferencial en milisegundos antes de que un trabajador sufra una descarga peligrosa.',
      riskIdentified: 'Contacto eléctrico indirecto al tocar la carcasa metálica de un receptor con fallo interno.',
      consequences: 'Tetanización muscular, electrocución y fibrilación ventricular.',
      preventiveMeasures: 'Mantener la continuidad del conductor de protección amarillo-verde, comprobar periódicamente el botón de test de los diferenciales y usar herramientas de Doble Aislamiento (Clase II).',
      legalReference: 'RD 614/2001 y Reglamento Electrotécnico para Baja Tensión (RD 842/2002, ITC-BT-24).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Riesgo Eléctrico',
    active: true,
  },
  {
    id: 'q_re_03',
    title: 'Manipulación de enchufes y alargaderas en planta',
    prompt:
      'Verdadero o Falso: Para desconectar una herramienta eléctrica portátil de la toma de corriente, es seguro tirar directamente del cable desde cierta distancia para ahorrar tiempo.',
    category: 'riesgos_electricos',
    difficulty: 'facil',
    type: 'true_false',
    options: [
      'Verdadero: los cables industriales están diseñados para desenchufarse tirando de ellos.',
      'Falso: siempre debe desenchufarse sujetando firmemente la clavija (enchufe), nunca tirando del cable.',
    ],
    correctIndices: [1],
    explanation: {
      whyCorrect:
        'Tirar del cable arranca los bornes internos de la clavija, deteriora el aislamiento y deja los conductores de cobre expuestos a contactos directos o cortocircuitos.',
      riskIdentified: 'Deterioro de aislamiento eléctrico y conductores activos al descubierto.',
      consequences: 'Choque eléctrico directo, chispazos e inicio de incendios de origen eléctrico.',
      preventiveMeasures: 'Tirar siempre del cuerpo de la clavija, no sobrecargar ladrones/bases múltiples y retirar cualquier cable con la funda dañada.',
      legalReference: 'RD 614/2001 (Anexo I) y RD 1215/1997.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Riesgo Eléctrico',
    active: true,
  },

  // ==================== 7. RIESGOS MECÁNICOS ====================
  {
    id: 'q_rm_01',
    title: 'Anulación de resguardos y dispositivos de seguridad',
    prompt:
      'Un operario puentea con cinta adhesiva el final de carrera de la puerta protectora de un centro de mecanizado para poder cargar piezas más rápido mientras el husillo sigue girando. ¿Cómo se califica esta práctica?',
    category: 'riesgos_mecanicos',
    difficulty: 'facil',
    type: 'practical_case',
    options: [
      'Un incumplimiento muy grave prohibido por la LPRL que genera un riesgo inminente de atrapamiento y amputación.',
      'Una mejora de productividad aceptable si el operario tiene mucha experiencia.',
      'Una práctica permitida durante el turno de noche.',
      'Algo recomendable cuando las piezas son pequeñas.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El artículo 29.2.3º de la Ley 31/1995 obliga expresamente a no poner fuera de funcionamiento y utilizar correctamente los dispositivos de seguridad existentes en los medios de trabajo.',
      riskIdentified: 'Acceso a órganos móviles en rotación (atrapamiento, corte, arrastre o proyección).',
      consequences: 'Aplastamiento de extremidades, amputaciones traumáticas o muerte.',
      preventiveMeasures: 'Prohibición estricta de anular enclavamientos, uso de detectores de seguridad codificados antimanipulación y supervisión periódica.',
      legalReference: 'Artículo 29.2.3º de la Ley 31/1995 y Anexo I.1.8 del RD 1215/1997.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Seguridad en Máquinas',
    active: true,
  },
  {
    id: 'q_rm_02',
    title: 'Función de la Parada de Emergencia (Seta Roja sobre fondo Amarillo)',
    prompt:
      'Respecto al órgano de accionamiento de parada de emergencia de una máquina industrial según el RD 1215/1997, ¿cuál de estas afirmaciones es correcta?',
    category: 'riesgos_mecanicos',
    difficulty: 'intermedio',
    type: 'test',
    options: [
      'Debe ser claramente visible (seta roja sobre fondo amarillo), detener el proceso peligroso en el menor tiempo posible y su desenclavamiento nunca debe volver a poner la máquina en marcha por sí solo.',
      'Al soltar la seta roja, la máquina debe arrancar automáticamente sin pulsar ningún botón de marcha.',
      'Debe estar guardada bajo llave dentro de la oficina para que nadie la pulse.',
      'Sustituye por completo a las carcasas y barreras fotoeléctricas.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El RD 1215/1997 exige que la orden de parada de emergencia tenga prioridad sobre todas las demás y que el rearme del pulsador no provoque un arranque inesperado, sino que requiera una acción voluntaria de puesta en marcha.',
      riskIdentified: 'Arranque intempestivo tras liberar una seta de emergencia.',
      consequences: 'Atrapamiento de las personas que están liberando el atasco o auxiliando a un compañero.',
      preventiveMeasures: 'Verificar periódicamente el circuito de parada de emergencia y mantener los pulsadores despejados y accesibles.',
      legalReference: 'RD 1215/1997, Anexo I, apartados 1.2 y 1.6 (Órganos de accionamiento y parada de emergencia).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Seguridad en Máquinas',
    active: true,
  },
  {
    id: 'q_rm_03',
    title: 'Riesgo de atrapamiento por ropa holgada o elementos colgantes',
    prompt:
      'Al trabajar cerca de ejes giratorios, taladros de columna o tornos convencionales, ¿qué medidas preventivas personales son indispensables?',
    category: 'riesgos_mecanicos',
    difficulty: 'intermedio',
    type: 'team_challenge',
    options: [
      'Llevar la ropa de trabajo bien ajustada en puños, recoger el cabello largo y retirar anillos, pulseras, relojes o cordones colgantes (y no usar guantes si existe riesgo de enganche en el giro).',
      'Llevar bufanda larga y mangas sueltas para protegerse del frío.',
      'Usar anillos y cadenas metálicas visibles.',
      'Sujetar la pieza con la mano en lugar de usar mordaza fijada a la mesa.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Los ejes y brocas en rotación enganchan instantáneamente mangas sueltas, cabellos, joyas o incluso guantes textiles, arrastrando la mano o al trabajador hacia el punto de giro.',
      riskIdentified: 'Enganche y arrastre por elementos rotativos.',
      consequences: 'Avulsión de dedos (por anillos), escalpe capilar o fracturas graves de brazo.',
      preventiveMeasures: 'Ropa ceñida sin elementos colgantes, cabello recogido, ausencia de joyas, resguardo telescópico en el husillo y fijación mecánica de la pieza con mordaza.',
      legalReference: 'RD 1215/1997 (Anexo I.1.8 y Anexo II sobre condiciones de utilización de equipos).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Seguridad en Máquinas',
    active: true,
  },

  // ==================== 8. RIESGOS QUÍMICOS Y BIOLÓGICOS ====================
  {
    id: 'q_rq_01',
    title: 'La Ficha de Datos de Seguridad (FDS) de un producto químico',
    prompt:
      '¿Qué documento técnico de 16 secciones debe proporcionar el proveedor de un agente químico peligroso y estar siempre a disposición de los trabajadores para conocer sus riesgos, EPI necesarios y medidas en caso de vertido o primeros auxilios?',
    category: 'riesgos_quimicos',
    difficulty: 'facil',
    type: 'test',
    options: [
      'La Ficha de Datos de Seguridad (FDS / SDS) junto con la etiqueta reglamentaria CLP.',
      'El albarán comercial de transporte sin texto técnico.',
      'Únicamente el catálogo publicitario del fabricante.',
      'Una nota manuscrita en un envase de bebida reutilizado.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La Ficha de Datos de Seguridad (Reglamento REACH y CLP) y el RD 374/2001 garantizan que el usuario profesional disponga de información detallada sobre peligrosidad, almacenamiento, límites de exposición (VLA) y actuación ante emergencias.',
      riskIdentified: 'Manipulación a ciegas de productos tóxicos, corrosivos o inflamables.',
      consequences: 'Quemaduras químicas, intoxicaciones por inhalación o reacciones violentas por mezcla de productos incompatibles.',
      preventiveMeasures: 'Mantener el registro actualizado de FDS accesible en el puesto, no trasvasar nunca a envases de alimentación y etiquetar todo recipiente secundario.',
      legalReference: 'RD 374/2001 (Agentes químicos), Reglamento (CE) 1907/2006 (REACH) y Reglamento (CE) 1272/2008 (CLP).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Higiene Industrial',
    active: true,
  },
  {
    id: 'q_rq_02',
    title: 'Mezcla peligrosa de productos de limpieza e industriales',
    prompt:
      'Verdadero o Falso: Mezclar lejía (hipoclorito sódico) con amoniaco o con desincrustantes ácidos mejora la desinfección sin generar ningún riesgo respiratorio.',
    category: 'riesgos_quimicos',
    difficulty: 'facil',
    type: 'true_false',
    options: [
      'Verdadero: potencia el efecto limpiador de forma segura.',
      'Falso: es extremadamente peligroso porque libera gases altamente tóxicos e irritantes (cloro gas o cloraminas) que pueden causar edema pulmonar agudo.',
    ],
    correctIndices: [1],
    explanation: {
      whyCorrect:
        'El hipoclorito sódico reacciona con ácidos desprendiendo gas cloro (Cl2) y con amoniaco formando cloraminas, gases muy tóxicos que dañan gravemente las vías respiratorias en pocos minutos.',
      riskIdentified: 'Inhalación aguda de gases tóxicos por reacción química incompatible.',
      consequences: 'Broncoespasmo severo, quemaduras de mucosas, edema pulmonar e intoxicación grave.',
      preventiveMeasures: 'Prohibir terminantemente la mezcla de productos químicos no autorizada en su FDS y almacenar ácidos y bases en cubetos separados.',
      legalReference: 'RD 374/2001 sobre protección frente a riesgos relacionados con agentes químicos.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Higiene Industrial',
    active: true,
  },
  {
    id: 'q_rq_03',
    title: 'Prevención frente a Agentes Biológicos y Objetos Cortopunzantes',
    prompt:
      'En un entorno sanitario o de laboratorio con riesgo biológico (RD 664/1997), ¿cuál es la norma fundamental tras utilizar una aguja o lanceta?',
    category: 'riesgos_quimicos',
    difficulty: 'intermedio',
    type: 'practical_case',
    options: [
      'Nunca reencapuchar la aguja con las dos manos y desecharla inmediatamente en el contenedor rígido amarillo de residuos biosanitarios punzantes.',
      'Reencapuchar siempre apretando el capuchón con la otra mano y tirarla a la papelera común.',
      'Doblar o romper la aguja manualmente antes de guardarla en el bolsillo de la bata.',
      'Dejarla sobre la bandeja metálica para que la recoja el turno siguiente.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El reencapuchado manual de agujas es la causa principal de pinchazos accidentales con riesgo de transmisión de virus sanguíneos (VHB, VHC, VIH).',
      riskIdentified: 'Inoculación accidental parenteral de agentes biológicos patógenos.',
      consequences: 'Infecciones graves por patógenos transmitidos por la sangre.',
      preventiveMeasures: 'Utilizar dispositivos de bioseguridad retráctiles, prohibir el reencapuchado y disponer de contenedores rígidos amarillos homologados al alcance de la mano.',
      legalReference: 'RD 664/1997 (Agentes biológicos) y Orden ESS/1451/2013 (Prevención de lesiones con instrumental cortopunzante).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Higiene Industrial',
    active: true,
  },

  // ==================== 9. ERGONOMÍA Y PVD ====================
  {
    id: 'q_er_pvd_01',
    title: 'Altura y posición de la Pantalla de Visualización de Datos (PVD)',
    prompt:
      'Para evitar sobrecarga muscular cervical y fatiga visual en el trabajo con ordenador (RD 488/1997), ¿cómo debe colocarse el monitor respecto al trabajador?',
    category: 'ergonomia',
    difficulty: 'facil',
    type: 'test',
    options: [
      'Frente al usuario (sin giros de cuello), a una distancia de 40-75 cm y con el borde superior de la pantalla a la altura de los ojos o ligeramente por debajo.',
      'En una esquina lateral de la mesa y al menos 25 cm por encima de la cabeza.',
      'Apoyado directamente sobre las rodillas durante toda la jornada.',
      'Frente a una ventana descubierta para recibir el sol directo en la cara.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Situar el monitor frente al cuerpo con el borde superior al nivel de los ojos mantiene el cuello en posición neutra (ángulo de visión de 0° a -30°) y evita torsiones cervicales.',
      riskIdentified: 'Posturas forzadas de cuello y fatiga visual.',
      consequences: 'Cervicalgias crónicas, cefaleas tensionales y astenopía ocular.',
      preventiveMeasures: 'Usar monitores regulables en altura o brazos articulados; si se trabaja de forma continuada con portátil, acoplar soporte elevador, teclado y ratón independientes.',
      legalReference: 'RD 488/1997 y Guía Técnica del INSST para la evaluación y prevención de riesgos relativos a PVD.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Ergonomía',
    active: true,
  },
  {
    id: 'q_er_pvd_02',
    title: 'Pausas y cambios de actividad en trabajos con PVD',
    prompt:
      'Según la Guía Técnica del INSST sobre el RD 488/1997, ¿qué medida organizativa es más eficaz frente a la fatiga visual y postural en tareas intensivas con pantallas?',
    category: 'ergonomia',
    difficulty: 'intermedio',
    type: 'test',
    options: [
      'Alternar el trabajo en pantalla con otras tareas y realizar pausas cortas y frecuentes (por ejemplo, 5-10 minutos cada hora o cada 2 horas) antes de que aparezca la fatiga, enfocando la vista a lo lejos.',
      'No levantarse de la silla durante 7 horas seguidas para terminar media hora antes.',
      'Trabajar completamente a oscuras con el brillo del monitor al 100%.',
      'Acercar los ojos a menos de 15 centímetros del monitor.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Las pausas breves y periódicas son mucho más reparadoras para la musculatura ocular y postural que una única pausa larga cuando la fatiga ya se ha instaurado.',
      riskIdentified: 'Carga estática postural y fatiga acomodativa ocular.',
      consequences: 'Trastornos musculoesqueléticos dorsolumbares, síndrome de ojo seco y fatiga mental.',
      preventiveMeasures: 'Aplicar micro-pausas activas, ejercicios de estiramiento suave y regla visual 20-20-20 (mirar a 6 metros durante 20 segundos cada 20 minutos).',
      legalReference: 'Artículo 4 del RD 488/1997 (Desarrollo diario del trabajo: pausas o cambios de actividad).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Ergonomía',
    active: true,
  },
  {
    id: 'q_er_pvd_03',
    title: 'Movimientos Repetitivos en Línea de Montaje',
    prompt:
      'En una línea de envasado, los trabajadores realizan ciclos repetitivos de muñeca y hombro cada 10 segundos. ¿Qué conjunto de medidas ergonómicas debe implantarse?',
    category: 'ergonomia',
    difficulty: 'avanzado',
    type: 'team_challenge',
    options: [
      'Rediseñar las herramientas para mantener la muñeca neutra, regular la altura del plano de trabajo, automatizar las fases más penosas y establecer rotación de puestos entre grupos musculares distintos.',
      'Aumentar el ritmo de la cinta transportadora un 40% adicional.',
      'Sustituir las sillas y obligar a trabajar de rodillas.',
      'Prohibir cambiar de postura durante el turno.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La prevención de trastornos musculoesqueléticos por movimientos repetitivos combina el diseño biomecánico del puesto (alturas, alcances y herramientas ergonómicas) con la rotación de tareas y tiempos de recuperación fisiológica.',
      riskIdentified: 'Sobrecarga biomecánica por alta frecuencia de repetición y posturas forzadas.',
      consequences: 'Tendinitis de hombro, epicondilitis y síndrome del túnel carpiano.',
      preventiveMeasures: 'Evaluación ergonómica (métodos OCRA/RULA), adaptación de alturas de trabajo al codo y rotación planificada de tareas.',
      legalReference: 'Artículo 15.1.d de la Ley 31/1995 (Adaptar el trabajo a la persona) y RD 486/1997.',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Ergonomía',
    active: true,
  },

  // ==================== 10. MANIPULACIÓN MANUAL DE CARGAS ====================
  {
    id: 'q_mmc_01',
    title: 'Peso máximo recomendado en condiciones ideales (INSST)',
    prompt:
      'Según la Guía Técnica del INSST para el Real Decreto 487/1997 sobre manipulación manual de cargas, ¿cuál es el peso máximo que se recomienda no sobrepasar en condiciones ideales de manipulación para un trabajador general (y para mayor protección de mujeres, jóvenes o mayores)?',
    category: 'manipulacion_cargas',
    difficulty: 'intermedio',
    type: 'test',
    options: [
      '25 kg en condiciones ideales generales (y 15 kg cuando se quiera proteger a la mayoría de la población trabajadora, como mujeres, trabajadores jóvenes o de mayor edad).',
      '80 kg por persona sin ayuda mecánica.',
      '100 kg si se levanta corriendo.',
      'No existe ningún límite orientativo en prevención.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La Guía Técnica del INSST establece 25 kg como valor máximo de referencia en condiciones ideales (carga pegada al cuerpo, a la altura de los codos, sin giros), reduciéndose a 15 kg para proteger al 95% de la población trabajadora.',
      riskIdentified: 'Sobreesfuerzo dorsolumbar por levantamiento de cargas pesadas.',
      consequences: 'Lumbalgias agudas, protrusiones y hernias discales.',
      preventiveMeasures: 'Priorizar ayudas mecánicas (carretillas, transpaletas eléctricas, polipastos, mesas elevadoras) o el levantamiento entre dos personas.',
      legalReference: 'RD 487/1997 sobre manipulación manual de cargas y Guía Técnica del INSST.',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Ergonomía y Cargas',
    active: true,
  },
  {
    id: 'q_mmc_02',
    title: 'Secuencia correcta para levantar una caja desde el suelo',
    prompt:
      'Ordena los 4 pasos de la técnica cinética segura para levantar manualmente una carga cuando no sea posible emplear medios mecánicos:',
    category: 'manipulacion_cargas',
    difficulty: 'intermedio',
    type: 'ordering',
    options: [
      '1º Apoyar los pies firmemente separados (a la anchura de los hombros) acercándose al máximo a la carga.',
      '2º Flexionar las rodillas manteniendo la espalda recta y el mentón metido.',
      '3º Sujetar firmemente la carga con ambas manos y pegarla al cuerpo (centro de gravedad próximo).',
      '4º Levantar extendiendo las piernas de forma suave y mover los pies para girar sin torsionar el tronco.',
    ],
    correctIndices: [0, 1, 2, 3],
    explanation: {
      whyCorrect:
        'Al flexionar las rodillas con la espalda recta y la carga pegada al cuerpo, el esfuerzo recae sobre los cuádriceps (músculos potentes de las piernas) y se reduce hasta cinco veces la compresión sobre el disco intervertebral L5-S1.',
      riskIdentified: 'Levantamiento con piernas rígidas, espalda encorvada y giro de cintura.',
      consequences: 'Pinzamiento vertebral y lesión aguda de los discos lumbares.',
      preventiveMeasures: 'Formación práctica en higiene postural, uso de asas seguras y prohibición de girar el tronco mientras se sostiene peso.',
      legalReference: 'RD 487/1997, Anexo (Factores de riesgo en la manipulación manual de cargas).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Ergonomía y Cargas',
    active: true,
  },
  {
    id: 'q_mmc_03',
    title: 'Empujar vs. Tirar de un carro o transpaleta manual',
    prompt:
      'Verdadero o Falso: Al desplazar un carro industrial o una transpaleta manual, ergonómicamente es preferible EMPUJAR la carga hacia delante (viendo el camino) en lugar de tirar de ella caminando de espaldas.',
    category: 'manipulacion_cargas',
    difficulty: 'facil',
    type: 'true_false',
    options: [
      'Verdadero: empujar aprovecha el peso del cuerpo con la espalda simétrica y permite ver la ruta sin torsión de tronco.',
      'Falso: siempre es mejor tirar con un solo brazo retorciendo el hombro hacia atrás.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Empujar con ambas manos a una altura entre la cintura y los hombros genera menor tensión asimétrica en los hombros y la columna lumbar, evita que el carro nos golpee los talones y garantiza visibilidad frontal.',
      riskIdentified: 'Tracción asimétrica con torsión de hombro y falta de visibilidad.',
      consequences: 'Lesiones de manguito rotador, lumbalgias y atropello de los propios pies.',
      preventiveMeasures: 'Empujar usando el peso corporal, mantener las ruedas limpias y bien engrasadas y asegurar suelos lisos sin baches.',
      legalReference: 'RD 487/1997 y NTP 674 del INSST (Operaciones de empuje y tracción).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Ergonomía y Cargas',
    active: true,
  },

  // ==================== 11. RIESGOS PSICOSOCIALES ====================
  {
    id: 'q_rp_01',
    title: 'Factores de Riesgo Psicosocial en la Organización',
    prompt:
      '¿Qué son los factores de riesgo psicosocial en el ámbito de la Prevención de Riesgos Laborales?',
    category: 'riesgos_psicosociales',
    difficulty: 'facil',
    type: 'test',
    options: [
      'Condiciones de la organización, el contenido del trabajo y la realización de la tarea (carga de trabajo, autonomía, claridad de rol, apoyo social, liderazgo) que tienen capacidad de afectar a la salud psíquica, física o social del trabajador.',
      'Rasgos genéticos inmutables ajenos por completo a la empresa.',
      'Riesgos que solo existen en empresas de más de 10.000 empleados.',
      'Aspectos que la Ley de Prevención excluye expresamente.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La Ergonomía y Psicosociología Aplicada es una de las cuatro especialidades preventivas oficiales en España (RD 39/1997) y analiza cómo el diseño organizativo afecta a la salud laboral.',
      riskIdentified: 'Sobrecarga cuantitativa, ambigüedad de rol, falta de autonomía o aislamiento.',
      consequences: 'Estrés laboral crónico, síndrome de estar quemado (Burnout), trastornos cardiovasculares, ansiedad e incremento de errores y accidentes.',
      preventiveMeasures: 'Evaluar los factores psicosociales (ej. método FPSICO del INSST), definir funciones claras, dimensionar cargas de trabajo y fomentar el apoyo social y la participación.',
      legalReference: 'Artículo 4.7.d y Artículo 15.1.d/g de la Ley 31/1995 y RD 39/1997.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Psicosociología',
    active: true,
  },
  {
    id: 'q_rp_02',
    title: 'Prevención del Acoso Laboral (Mobbing) y Protocolos de Actuación',
    prompt:
      'Ante una situación de violencia psicológica continuada o acoso laboral en el entorno de trabajo, ¿qué medidas preventivas debe disponer y activar la organización?',
    category: 'riesgos_psicosociales',
    difficulty: 'intermedio',
    type: 'practical_case',
    options: [
      'Tolerancia cero, disponer de un Protocolo de Prevención y Actuación frente al Acoso con canal confidencial, investigar de forma ágil e imparcial y adoptar medidas cautelares y correctoras.',
      'Ignorar la comunicación esperando a que las partes lo resuelvan por su cuenta tras varios años.',
      'Sancionar a quien informa del problema.',
      'Publicar los datos médicos confidenciales en el tablón de anuncios.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La empresa debe garantizar un entorno de trabajo libre de violencia y acoso, protegiendo la dignidad e integridad moral y psicológica de todas las personas trabajadoras.',
      riskIdentified: 'Violencia psicológica, hostigamiento y deterioro grave del clima laboral.',
      consequences: 'Daños severos a la salud mental y física de la víctima, bajas prolongadas y deterioro organizativo.',
      preventiveMeasures: 'Implantar códigos éticos, formación en liderazgo respetuoso, protocolos confidenciales de investigación rápida y apoyo psicosocial.',
      legalReference: 'Artículos 14 y 15 de la Ley 31/1995, Criterio Técnico 69/2009 de la ITSS y NTP 854 del INSST.',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Psicosociología',
    active: true,
  },
  {
    id: 'q_rp_03',
    title: 'Desconexión Digital y Prevención de la Fatiga Tecnológica',
    prompt:
      '¿Qué finalidad preventiva tiene el derecho a la desconexión digital fuera del tiempo de trabajo reconocido en la normativa española?',
    category: 'riesgos_psicosociales',
    difficulty: 'intermedio',
    type: 'test',
    options: [
      'Garantizar el respeto al tiempo de descanso, permisos y vacaciones, así como la intimidad personal y familiar, previniendo la hiperconectividad y la fatiga informática.',
      'Prohibir el uso de ordenadores durante la jornada laboral ordinaria.',
      'Obligar a responder correos electrónicos a las tres de la madrugada.',
      'Sustituir las vacaciones anuales por mensajes de texto.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La desconexión digital evita la prolongación encubierta de la jornada y permite la recuperación psicofisiológica necesaria entre turnos de trabajo.',
      riskIdentified: 'Hiperconectividad permanente, tecnoestrés e interrupción del sueño.',
      consequences: 'Trastornos del sueño, agotamiento emocional (burnout) y conflicto trabajo-familia.',
      preventiveMeasures: 'Política interna de desconexión digital, programación de envíos dentro del horario laboral y sensibilización de mandos.',
      legalReference: 'Artículo 88 de la Ley Orgánica 3/2018 (LOPDGDD) y Artículo 20 bis del Estatuto de los Trabajadores.',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Psicosociología',
    active: true,
  },

  // ==================== 12. INCENDIOS ====================
  {
    id: 'q_in_01',
    title: 'El Tetraedro del Fuego',
    prompt:
      '¿Cuáles son los cuatro elementos que componen el "Tetraedro del Fuego" y cuya coexistencia es necesaria para que un incendio se inicie y se mantenga con llama?',
    category: 'incendios',
    difficulty: 'facil',
    type: 'test',
    options: [
      'Combustible, Comburente (generalmente oxígeno), Energía de activación (calor) y Reacción en cadena.',
      'Agua, Nitrógeno, Dióxido de carbono y Arena.',
      'Madera, Humo, Ceniza y Sirena.',
      'Electricidad, Viento, Lluvia y Acero.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Para que exista fuego con llama deben concurrir simultáneamente combustible, comburente, calor y la reacción química en cadena; eliminar cualquiera de ellos extingue el incendio (por eliminación, sofocación, enfriamiento o inhibición).',
      riskIdentified: 'Coexistencia descontrolada de materiales inflamables y focos de ignición.',
      consequences: 'Inicio y propagación rápida de incendios industriales.',
      preventiveMeasures: 'Separar combustibles de focos de calor, ventilar atmósferas inflamables y disponer de agentes extintores adecuados a cada clase de fuego.',
      legalReference: 'RD 513/2017 (RIPCI) y RD 2267/2004 (RSCIEI - Seguridad contra incendios en establecimientos industriales).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Seguridad contra Incendios',
    active: true,
  },
  {
    id: 'q_in_02',
    title: 'Selección de Extintor para Cuadros Eléctricos',
    prompt:
      'Se produce un conato de incendio en el interior de un armario de servidores y cuadros eléctricos. ¿Qué agente extintor portátil es el más adecuado por no conducir la electricidad ni dejar residuos corrosivos en la electrónica?',
    category: 'incendios',
    difficulty: 'intermedio',
    type: 'visual_id',
    visualSceneHint: 'Extintor rojo con difusor troncocónico negro (CO2)',
    options: [
      'Extintor de CO2 (Dióxido de Carbono / Nieve Carbónica).',
      'Agua a chorro directo desde un cubo o manguera.',
      'Espuma física conductora de alta humedad.',
      'Soplar con un ventilador industrial para avivar el aire.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El CO2 es un gas inerte y dieléctrico que extingue por sofocación (desplazamiento del oxígeno) y enfriamiento sin conducir la corriente eléctrica ni dañar los componentes electrónicos.',
      riskIdentified: 'Riesgo de electrocución del operador al usar agentes conductores sobre equipos en tensión.',
      consequences: 'Electrocución grave y destrucción total de la instalación eléctrica.',
      preventiveMeasures: 'Instalar extintores de CO2 de 2 kg o 5 kg junto a todos los cuadros eléctricos y salas técnicas, y sujetar el difusor por su empuñadura aislante para evitar quemaduras por frío.',
      legalReference: 'RD 513/2017 (RIPCI, Anexo I sobre extintores de incendio).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Seguridad contra Incendios',
    active: true,
  },
  {
    id: 'q_in_03',
    title: 'Incendio de Aceites y Grasas en Cocina Industrial (Clase F)',
    prompt:
      'En una cocina industrial comienza a arder el aceite sobrecalentado de una freidora (Fuego Clase F). ¿Qué acción NUNCA debe realizarse y cuál es la correcta?',
    category: 'incendios',
    difficulty: 'avanzado',
    type: 'practical_case',
    options: [
      'NUNCA echar agua (provocaría una violenta explosión de vapor "boilover"); se debe cortar la energía, cubrir con manta ignífuga o usar extintor específico para fuegos Clase F.',
      'Echar un cubo lleno de agua fría de golpe sobre el aceite hirviendo.',
      'Coger la freidora en llamas con las manos desnudas y correr por el comedor.',
      'Echar harina o azúcar sobre la llama.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Al verter agua sobre aceite a más de 300 °C, el agua se vaporiza instantáneamente multiplicando su volumen por 1.700 y proyectando una bola de fuego de aceite hirviendo por toda la estancia.',
      riskIdentified: 'Fenómeno de rebosamiento violento (boilover/slopover) por contacto de agua con grasa ardiente.',
      consequences: 'Quemaduras de tercer grado en cara y cuerpo y propagación inmediata del incendio a la campana extractora.',
      preventiveMeasures: 'Cortar el gas/electricidad, sofocar con manta ignífuga o aplicar agente extintor químico húmedo Clase F (acetato potásico que saponifica la grasa).',
      legalReference: 'Norma UNE-EN 2 (Clases de fuego, incluyendo Clase F) y RD 513/2017.',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Seguridad contra Incendios',
    active: true,
  },

  // ==================== 13. EMERGENCIAS Y EVACUACIÓN ====================
  {
    id: 'q_ee_01',
    title: 'Normas básicas durante una Evacuación de Emergencia',
    prompt:
      'Suena la sirena de evacuación general en el centro de trabajo. ¿Cuál de los siguientes comportamientos es el CORRECTO?',
    category: 'emergencias_evacuacion',
    difficulty: 'facil',
    type: 'test',
    options: [
      'Dejar la tarea de forma segura, caminar rápido pero sin correr ni empujar, no utilizar nunca los ascensores, no retroceder a por objetos personales y dirigirse al Punto de Encuentro.',
      'Correr gritando hacia el ascensor para llegar el primero al sótano.',
      'Volver a la oficina cerrada con humo para buscar el cargador del móvil.',
      'Esconderse dentro de un armario sin avisar a nadie.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Una evacuación ordenada siguiendo las vías señalizadas hacia el Punto de Encuentro sin usar ascensores ni retroceder evita el pánico, los atrapamientos y facilita la labor de los equipos de emergencia.',
      riskIdentified: 'Atrapamiento en ascensores, inhalación de humos y caídas por avalancha.',
      consequences: 'Intoxicación por monóxido de carbono, traumatismos en escaleras y personas desaparecidas sin contabilizar.',
      preventiveMeasures: 'Realizar simulacros periódicos de evacuación (al menos una vez al año) y conocer la ubicación del Punto de Encuentro.',
      legalReference: 'Artículo 20 de la Ley 31/1995 y RD 393/2007 (Norma Básica de Autoprotección).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Emergencias',
    active: true,
  },
  {
    id: 'q_ee_02',
    title: 'Desplazamiento en presencia de humo denso',
    prompt:
      'Si durante la evacuación de una zona incendiada te encuentras con un pasillo invadido por humo, ¿cómo debes desplazarte hacia la salida?',
    category: 'emergencias_evacuacion',
    difficulty: 'intermedio',
    type: 'practical_case',
    options: [
      'Agachado o gateando lo más cerca posible del suelo (donde el aire está más limpio y frío), protegiendo nariz y boca con un paño (preferiblemente húmedo) y siguiendo la pared hacia la salida.',
      'Caminando totalmente erguido y respirando profundamente por la boca en la parte alta del techo.',
      'Quitándose el calzado y apagando las luces de emergencia.',
      'Abriendo todas las ventanas y puertas para crear corriente de aire hacia el fuego.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El humo y los gases tóxicos calientes tienden a ascender hacia el techo, dejando en los primeros 30-50 centímetros junto al suelo una capa de aire más respirable y con mejor visibilidad.',
      riskIdentified: 'Inhalación de gases tóxicos calientes (CO, HCN) y pérdida de orientación.',
      consequences: 'Quemadura de vías aéreas superiores y pérdida de conocimiento por hipoxia en pocas inhalaciones.',
      preventiveMeasures: 'Avanzar a ras de suelo tocando la pared guía y comprobar con el dorso de la mano la temperatura de las puertas cerradas antes de abrirlas.',
      legalReference: 'Artículo 20 de la Ley 31/1995 y guías de autoprotección de Protección Civil e INSST.',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Emergencias',
    active: true,
  },
  {
    id: 'q_ee_03',
    title: 'Funciones de los Equipos de Emergencia (EPI, ESI, EAE, EPA)',
    prompt:
      'Dentro del Plan de Emergencia y Autoprotección de una empresa, ¿qué significan las siglas EAE y cuál es su misión principal?',
    category: 'emergencias_evacuacion',
    difficulty: 'avanzado',
    type: 'test',
    options: [
      'Equipo de Alarma y Evacuación: su misión es asegurar una evacuación total y ordenada de su sector y verificar en el Punto de Encuentro que no queda nadie rezagado.',
      'Equipo de Almacenamiento Externo: encargado de pedir suministros de oficina.',
      'Especialistas en Auditoría Económica: encargados de la contabilidad.',
      'Equipo de Arranque Eléctrico: encargado de encender las máquinas durante el incendio.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Los planes de emergencia estructuran las brigadas en: EPI (Primera Intervención), ESI (Segunda Intervención), EPA (Primeros Auxilios) y EAE (Alarma y Evacuación), coordinados por el Jefe de Emergencia.',
      riskIdentified: 'Descoordinación durante una emergencia real y personas olvidadas en aseos o salas aisladas.',
      consequences: 'Trabajadores atrapados sin que los servicios exteriores tengan constancia de su ausencia.',
      preventiveMeasures: 'Designar, formar y entrenar a los miembros de los equipos de emergencia y realizar simulacros periódicos.',
      legalReference: 'Artículo 20 de la Ley 31/1995 y RD 393/2007 (Norma Básica de Autoprotección).',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Emergencias',
    active: true,
  },

  // ==================== 14. PRIMEROS AUXILIOS ====================
  {
    id: 'q_pa_01',
    title: 'La Conducta PAS en Primeros Auxilios',
    prompt:
      'Ordena correctamente las 3 fases de la conducta PAS, protocolo universal de actuación ante cualquier accidente con heridos:',
    category: 'primeros_auxilios',
    difficulty: 'facil',
    type: 'ordering',
    options: [
      '1º PROTEGER: Asegurar el lugar del accidente para evitar nuevos riesgos para el accidentado y para quien socorre.',
      '2º AVISAR: Alertar a los servicios de emergencia (112) o servicio médico indicando lugar exacto, tipo de accidente y estado de las víctimas.',
      '3º SOCORRER: Evaluar signos vitales (consciencia y respiración) y prestar los primeros auxilios sin agravar las lesiones.',
    ],
    correctIndices: [0, 1, 2],
    explanation: {
      whyCorrect:
        'Nunca se debe intentar socorrer sin haber protegido antes el entorno (ej. cortar corriente, ventilar o señalizar) y haber activado la cadena de socorro avisando al 112.',
      riskIdentified: 'Sobre-accidente del socorrista o demora en la asistencia médica avanzada.',
      consequences: 'Aumento del número de víctimas o empeoramiento irreversible del herido.',
      preventiveMeasures: 'Formar al personal en protocolo PAS y soporte vital básico y señalizar claramente los números de emergencia y botiquines.',
      legalReference: 'Artículo 20 de la Ley 31/1995 y Anexo VI del RD 486/1997 (Material y locales de primeros auxilios).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Primeros Auxilios',
    active: true,
  },
  {
    id: 'q_pa_02',
    title: 'Actuación ante Hemorragia Externa Severa',
    prompt:
      'Un trabajador sufre un corte profundo en el antebrazo con sangrado abundante. ¿Cuál es la primera maniobra de primeros auxilios que debe realizarse?',
    category: 'primeros_auxilios',
    difficulty: 'intermedio',
    type: 'practical_case',
    options: [
      'Aplicar compresión directa y firme sobre la herida utilizando gasas o apósitos estériles (con guantes de protección) sin retirar el primer apósito aunque se empape.',
      'Aplicar barro, aceite industrial o pasta de dientes sobre la herida abierta.',
      'Retirar continuamente las gasas cada 10 segundos rompiendo el coágulo que se está formando.',
      'Darle bebidas alcohólicas al herido.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La presión directa mantenida con apósitos limpios o estériles es el método de elección para cohibir la inmensa mayoría de las hemorragias externas; si el primer apósito se empapa, se colocan otros encima sin levantarlo para no destruir el coágulo.',
      riskIdentified: 'Pérdida aguda de volumen sanguíneo (shock hipovolémico) e infección.',
      consequences: 'Shock hipovolémico y riesgo vital si no se controla el sangrado.',
      preventiveMeasures: 'Disponer de botiquines dotados conforme al Anexo VI del RD 486/1997 y personal entrenado en control de hemorragias.',
      legalReference: 'RD 486/1997, Anexo VI y guías de Primeros Auxilios del INSST (NTP 458 / Consejo Europeo de Resucitación).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Primeros Auxilios',
    active: true,
  },
  {
    id: 'q_pa_03',
    title: 'Primeros Auxilios ante Quemaduras Térmicas',
    prompt:
      'Verdadero o Falso: Ante una quemadura térmica en la mano, lo correcto es enfriar la zona con agua corriente fresca (no helada) durante 10-15 minutos, no pinchar nunca las ampollas (flictenas) y no despegar la ropa que esté adherida a la piel.',
    category: 'primeros_auxilios',
    difficulty: 'intermedio',
    type: 'true_false',
    options: [
      'Verdadero: enfriar con agua frena el daño térmico profundo y respetar las ampollas evita infecciones.',
      'Falso: hay que reventar todas las ampollas con una aguja sucia y arrancar de un tirón la ropa pegada.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El agua fresca detiene la transmisión de calor hacia las capas profundas de la dermis, mientras que la piel de la ampolla actúa como apósito biológico estéril frente a las bacterias.',
      riskIdentified: 'Agravamiento de la profundidad de la quemadura e infección bacteriana.',
      consequences: 'Necrosis tisular más profunda, septicemia y secuelas cicatriciales graves.',
      preventiveMeasures: 'Irrigar con agua suave 10-15 min, retirar anillos/relojes antes de que se inflame la zona, cubrir con gasa estéril húmeda y trasladar a valoración médica.',
      legalReference: 'Guías técnicas de Primeros Auxilios del INSST (NTP 524) y Anexo VI del RD 486/1997.',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Primeros Auxilios',
    active: true,
  },

  // ==================== 15. INVESTIGACIÓN DE ACCIDENTES ====================
  {
    id: 'q_ia_01',
    title: 'Objetivo legal y técnico de la Investigación de Accidentes',
    prompt:
      'Según el artículo 16.3 de la Ley 31/1995, cuando se haya producido un daño para la salud de los trabajadores, el empresario deberá llevar a cabo una investigación al respecto. ¿Con qué finalidad principal?',
    category: 'investigacion_accidentes',
    difficulty: 'facil',
    type: 'test',
    options: [
      'A fin de detectar las causas de estos hechos y adoptar las medidas preventivas y correctoras necesarias para evitar que vuelvan a repetirse.',
      'Únicamente para buscar un culpable al que despedir sin cambiar nada en la máquina.',
      'Para ocultar el suceso y no comunicarlo a la autoridad laboral.',
      'Solo por curiosidad estadística sin aplicar mejoras técnicas.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'La investigación de accidentes e incidentes tiene una finalidad estrictamente preventiva: identificar los fallos del sistema de prevención (causas técnicas, organizativas y humanas) para impedir su recurrencia.',
      riskIdentified: 'Repetición de accidentes idénticos por no corregir las causas raíz.',
      consequences: 'Nuevos accidentes cada vez más graves en el mismo puesto o equipo.',
      preventiveMeasures: 'Investigar todos los accidentes (con y sin baja) y los incidentes ("casi-accidentes"), aplicando el método del Árbol de Causas.',
      legalReference: 'Artículo 16.3 de la Ley 31/1995, de Prevención de Riesgos Laborales.',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Investigación de Siniestros',
    active: true,
  },
  {
    id: 'q_ia_02',
    title: 'Causas Inmediatas vs. Causas Básicas en un Accidente',
    prompt:
      'En una prensa hidráulica, un operario de nueva incorporación sufre un atrapamiento porque el resguardo estaba desmontado desde hacía dos semanas y nadie le había impartido formación ni existía procedimiento de revisión. ¿Cuáles son las CAUSAS BÁSICAS (de raíz) de este accidente?',
    category: 'investigacion_accidentes',
    difficulty: 'avanzado',
    type: 'accident_investigation',
    options: [
      'La falta de formación e instrucción preventiva al trabajador, la ausencia de mantenimiento preventivo y el fallo de supervisión de seguridad (factores personales y del trabajo).',
      'La mala suerte o la fatalidad del destino en ese minuto concreto.',
      'El color de la pintura exterior de la nave industrial.',
      'Únicamente el último movimiento reflejo de la mano sin analizar por qué faltaba el resguardo.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Mientras que el resguardo ausente es una condición insegura inmediata, las causas básicas explican por qué existía esa condición: ausencia de programa de mantenimiento, falta de formación (Art. 19 LPRL) y deficiencia en el control operativo.',
      riskIdentified: 'Análisis superficial que no corrige los fallos de gestión preventiva.',
      consequences: 'Persistencia de las deficiencias organizativas en el resto de máquinas de la planta.',
      preventiveMeasures: 'Actuar siempre sobre las causas básicas: implantar bloqueo de máquinas sin resguardo, formación teórica y práctica previa al puesto y chequeos pre-turno.',
      legalReference: 'Artículo 16.3 y Artículo 19 de la Ley 31/1995, y NTP 274 / NTP 442 del INSST (Investigación de accidentes: árbol de causas).',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Investigación de Siniestros',
    active: true,
  },
  {
    id: 'q_ia_03',
    title: 'Importancia de investigar los Incidentes o "Accidentes Blancos"',
    prompt:
      'Cae una carga de 200 kg desde una grúa puente por rotura de una eslinga desgastada, impactando en el suelo a un metro de un trabajador sin llegar a tocarle. ¿Debe investigarse este suceso aunque no haya habido lesionados?',
    category: 'investigacion_accidentes',
    difficulty: 'intermedio',
    type: 'practical_case',
    options: [
      'Sí, es imprescindible investigarlo: es un incidente de alto potencial que revela un fallo crítico (eslinga sin revisión) y cuya investigación evita el próximo accidente mortal.',
      'No, si nadie ha ido al hospital no tiene ninguna importancia preventiva.',
      'Solo hay que barrer el suelo y volver a usar otra eslinga igual de desgastada.',
      'Está prohibido registrar incidentes sin baja médica.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'En la pirámide de siniestralidad (Bird/Heinrich), por cada accidente grave o mortal se producen numerosos incidentes previos sin lesión; investigarlos permite actuar antes de que haya víctimas.',
      riskIdentified: 'Fallo en elementos de izado y elevación de cargas.',
      consequences: 'Aplastamiento mortal en la siguiente maniobra si no se revisan las eslingas y el procedimiento de izado.',
      preventiveMeasures: 'Fomentar la notificación de incidentes sin represalias, revisar certificaciones de eslingas (UNE-EN 1492) y prohibir el paso bajo cargas suspendidas.',
      legalReference: 'Artículo 16.3 de la Ley 31/1995 y NTP 592 del INSST (Gestión integral de accidentes e incidentes).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Investigación de Siniestros',
    active: true,
  },

  // ==================== 16. MEDIDAS PREVENTIVAS Y COLECTIVAS ====================
  {
    id: 'q_mp_01',
    title: 'Protección Colectiva frente a Protección Individual',
    prompt:
      '¿Cuál de las siguientes opciones es un ejemplo de medida de PROTECCIÓN COLECTIVA (que protege simultáneamente a varios trabajadores y tiene prioridad sobre el EPI según el Art. 15 LPRL)?',
    category: 'medidas_preventivas',
    difficulty: 'facil',
    type: 'test',
    options: [
      'Barandillas perimetrales resistentes (mínimo 90 cm con listón intermedio y rodapié), redes de seguridad y sistemas de extracción localizada de humos.',
      'Un par de tapones auditivos de espuma de uso personal.',
      'Unas botas de seguridad individuales.',
      'Unas gafas graduadas de protección personal.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'Las barandillas, redes, resguardos, interruptores diferenciales y sistemas de ventilación/extracción protegen a todas las personas expuestas en el área de forma colectiva.',
      riskIdentified: 'Desconocimiento de las medidas colectivas prioritarias.',
      consequences: 'Diseños de seguridad deficientes que dejan el peligro abierto en el entorno.',
      preventiveMeasures: 'Instalar siempre protecciones colectivas certificadas y recurrir al EPI como complemento cuando el riesgo residual no pueda evitarse por medios colectivos.',
      legalReference: 'Artículo 15.1.h de la Ley 31/1995 y RD 486/1997 (Anexo I.A.3 sobre barandillas).',
    },
    points: 10,
    timeSeconds: 30,
    collection: 'Medidas Preventivas',
    active: true,
  },
  {
    id: 'q_mp_02',
    title: 'Presencia del Recurso Preventivo en Actividades de Especial Riesgo',
    prompt:
      'Según el artículo 32 bis de la Ley 31/1995, ¿en qué situaciones es obligatoria la presencia en el centro de trabajo de los Recursos Preventivos designados?',
    category: 'medidas_preventivas',
    difficulty: 'avanzado',
    type: 'team_challenge',
    options: [
      'Cuando los riesgos puedan verse agravados o modificados durante el proceso por la concurrencia de operaciones diversas, o cuando se realicen actividades reglamentariamente consideradas peligrosas o con riesgos especiales (como trabajos con riesgo especialmente grave de caída de altura o espacios confinados).',
      'Únicamente en oficinas administrativas sin atención al público.',
      'Solo durante las comidas de empresa de fin de año.',
      'Nunca es obligatoria su presencia física en el centro.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El Recurso Preventivo vigila in situ el cumplimiento de las actividades preventivas en operaciones concurrentes o de especial peligrosidad (trabajos en altura graves, espacios confinados, zanjas, alta tensión, etc.).',
      riskIdentified: 'Falta de supervisión preventiva en tiempo real durante maniobras críticas.',
      consequences: 'Incumplimiento de procedimientos de seguridad en trabajos de alto riesgo con consecuencias mortales.',
      preventiveMeasures: 'Nombrar y formar a los Recursos Preventivos (mínimo nivel básico de 50/60 h) y garantizar su permanencia en el tajo durante toda la operación crítica.',
      legalReference: 'Artículo 32 bis de la Ley 31/1995 y Artículo 22 bis del RD 39/1997.',
    },
    points: 30,
    timeSeconds: 60,
    collection: 'Medidas Preventivas',
    active: true,
  },
  {
    id: 'q_mp_03',
    title: 'Participación y Consulta: Delegados de Prevención y Comité de Seguridad y Salud',
    prompt:
      '¿Qué órgano paritario y colegiado de participación, formado por los Delegados de Prevención y por representantes de la empresa en igual número, se constituye en las empresas o centros de trabajo que cuenten con 50 o más trabajadores?',
    category: 'medidas_preventivas',
    difficulty: 'intermedio',
    type: 'test',
    options: [
      'El Comité de Seguridad y Salud (CSS).',
      'El Club Deportivo de la empresa.',
      'El Departamento de Marketing.',
      'El Registro Mercantil Provincial.',
    ],
    correctIndices: [0],
    explanation: {
      whyCorrect:
        'El artículo 38 de la Ley 31/1995 regula el Comité de Seguridad y Salud como el órgano paritario de consulta regular y periódica de las actuaciones de la empresa en materia de prevención de riesgos.',
      riskIdentified: 'Ausencia de participación de los trabajadores en la mejora de las condiciones de seguridad.',
      consequences: 'Medidas preventivas desconectadas de la realidad práctica de los puestos de trabajo.',
      preventiveMeasures: 'Garantizar los derechos de información, consulta y participación (Capítulo V LPRL) y reunir al Comité de Seguridad y Salud al menos trimestralmente.',
      legalReference: 'Artículos 34 a 39 de la Ley 31/1995 (Consulta y participación de los trabajadores).',
    },
    points: 20,
    timeSeconds: 45,
    collection: 'Medidas Preventivas',
    active: true,
  },
];
