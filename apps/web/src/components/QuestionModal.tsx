import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Scale,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  BADGE_DEFINITIONS,
  BOARD_TILES,
  PRL_CATEGORY_LABELS,
  TEAM_ROLE_INFO,
  canPlayerActOnTeamTurn,
} from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { soundEngine } from '../audio/SoundEngine';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  test: 'Pregunta Tipo Test',
  true_false: 'Verdadero o Falso',
  visual_id: 'Identificación Visual de Peligro',
  epi_select: 'Selección Múltiple de EPI',
  ordering: 'Ordenación Secuencial Preventiva',
  practical_case: 'Situación Práctica Laboral',
  accident_investigation: 'Investigación de Accidente',
  team_challenge: 'Debate y Desafío de Equipo',
};

export const QuestionModal: React.FC = () => {
  const {
    roomState,
    playerId,
    isRollingAnimation,
    isTokenMoving,
    challengeModalReady,
    submitAnswer,
    nextTurn,
  } = useGameStore();
  const activeChallenge = roomState?.activeChallenge;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [orderOptionIds, setOrderOptionIds] = useState<string[]>([]);
  const [collaborated, setCollaborated] = useState<boolean>(true);
  const [secondsLeft, setSecondsLeft] = useState<number>(45);

  const question = activeChallenge?.kind === 'question' ? activeChallenge.question : undefined;
  const activeTeam = roomState?.teams[roomState.activeTeamIndex ?? 0];
  const tile = BOARD_TILES.find((t) => t.index === activeChallenge?.tileIndex);
  const isMyTurn = roomState ? canPlayerActOnTeamTurn(roomState, playerId).allowed : false;

  const optionIds = question
    ? question.optionIds && question.optionIds.length === question.options.length
      ? question.optionIds
      : question.options.map((_, idx) => `${question.id}_opt_${idx}`)
    : [];
  const optionIdsSignature = optionIds.join('|');

  const isModalVisible = Boolean(
    roomState &&
      activeChallenge &&
      activeChallenge.kind === 'question' &&
      question &&
      challengeModalReady &&
      !isRollingAnimation &&
      !isTokenMoving
  );

  useEffect(() => {
    if (!question || !activeChallenge || !isModalVisible) return;
    setSelectedIds([]);
    if (question.type === 'ordering') {
      setOrderOptionIds([...optionIds]);
    }
    setSecondsLeft(question.timeSeconds);
  }, [question?.id, activeChallenge?.startedAt, optionIdsSignature, isModalVisible]);

  useEffect(() => {
    if (
      !isModalVisible ||
      !question ||
      !activeChallenge ||
      activeChallenge.answered ||
      roomState?.status === 'paused'
    ) {
      return;
    }

    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((activeChallenge.expiresAt - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 5 && remaining > 0) {
        soundEngine.playSfx('countdown_tick');
      }
      if (remaining === 0) {
        soundEngine.playSfx('time_up');
        clearInterval(timer);
        // Only the active turn's player/teacher submits the timeout resolution
        if (isMyTurn) {
          submitAnswer(['__TIMEOUT__'], false);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isModalVisible,
    question?.id,
    activeChallenge?.answered,
    activeChallenge?.expiresAt,
    roomState?.status,
    isMyTurn,
    submitAnswer,
  ]);

  if (!isModalVisible || !roomState || !activeChallenge || !question) {
    return null;
  }

  const isAnswered = activeChallenge.answered;
  const isCorrect = Boolean(activeChallenge.isCorrect);

  const handleToggleOption = (optId: string) => {
    if (isAnswered || !isMyTurn) return;
    soundEngine.playSfx('button_click');
    if (question.type === 'epi_select') {
      setSelectedIds((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
    } else {
      setSelectedIds([optId]);
    }
  };

  const moveOrderItem = (pos: number, dir: -1 | 1) => {
    if (isAnswered || !isMyTurn) return;
    const target = pos + dir;
    if (target < 0 || target >= orderOptionIds.length) return;
    soundEngine.playSfx('button_click');
    const copy = [...orderOptionIds];
    const tmp = copy[pos];
    copy[pos] = copy[target];
    copy[target] = tmp;
    setOrderOptionIds(copy);
  };

  const handleConfirm = () => {
    if (isAnswered || !isMyTurn) return;
    if (question.type === 'ordering') {
      submitAnswer(orderOptionIds, collaborated);
    } else {
      if (selectedIds.length === 0) return;
      submitAnswer(selectedIds, collaborated);
    }
  };

  return (
    <div className="modal-backdrop question-backdrop" role="dialog" aria-modal="true">
      <div
        className={`modal-card question-card-3d modal-animate-in ${
          isAnswered ? (isCorrect ? 'card-correct' : 'card-wrong') : ''
        }`}
      >
        {/* Cabecera con categoría, dificultad, puntos y temporizador */}
        <div className="q-header-strip">
          <div className="q-badges-row">
            <span className="q-chip-tile" style={{ background: tile?.color ?? '#0284C7' }}>
              Casilla #{activeChallenge.tileIndex} · {tile?.name}
            </span>
            <span className="q-chip-cat">{PRL_CATEGORY_LABELS[question.category]}</span>
            <span className={`q-chip-diff diff-${question.difficulty}`}>
              Nivel {question.difficulty.toUpperCase()} ({question.points} pts)
            </span>
            <span className="q-chip-type">
              {QUESTION_TYPE_LABELS[question.type] ?? question.type}
            </span>
          </div>

          <div className={`q-timer-pill ${secondsLeft <= 10 && !isAnswered ? 'timer-urgent' : ''}`}>
            <Clock size={18} />
            <span>{isAnswered ? 'Respondido' : `${secondsLeft}s`}</span>
          </div>
        </div>

        {/* Roles rotativos del equipo activo en este turno */}
        {activeTeam && activeTeam.currentRoles.length > 0 && (
          <div className="team-roles-banner" style={{ borderLeftColor: activeTeam.hexColor }}>
            <div className="roles-banner-title">
              <Users size={16} />
              <strong>Responsabilidades rotativas de {activeTeam.name} en este turno:</strong>
            </div>
            <div className="roles-chips-wrap">
              {activeTeam.currentRoles.map((assignment) =>
                assignment.roles.map((r) => (
                  <span key={`${assignment.playerId}_${r}`} className="role-assignment-chip">
                    <em>{TEAM_ROLE_INFO[r].title}:</em> {assignment.playerName}
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* Enunciado y escena visual si aplica */}
        <div className="q-body-section">
          <h2 className="q-title">{question.title}</h2>
          {question.visualSceneHint && (
            <div className="q-visual-scene-banner">
              <AlertTriangle size={20} className="text-yellow" />
              <span>Escenario inspeccionado en planta: {question.visualSceneHint}</span>
            </div>
          )}
          <p className="q-prompt">{question.prompt}</p>

          {/* Opciones de respuesta */}
          {question.type === 'ordering' ? (
            <div className="q-ordering-list">
              <p className="q-helper-note">
                Utiliza las flechas para ordenar la secuencia preventiva correcta de arriba a abajo:
              </p>
              {orderOptionIds.map((optId, posIdx) => {
                const optTextIdx = optionIds.indexOf(optId);
                const optText = optTextIdx >= 0 ? question.options[optTextIdx] : '';
                return (
                  <div key={optId} className="q-order-item">
                    <span className="q-order-step">Paso {posIdx + 1}</span>
                    <span className="q-order-text">{optText}</span>
                    {!isAnswered && (
                      <div className="q-order-btns">
                        <button
                          type="button"
                          onClick={() => moveOrderItem(posIdx, -1)}
                          disabled={posIdx === 0 || !isMyTurn}
                          aria-label="Subir paso"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOrderItem(posIdx, 1)}
                          disabled={posIdx === orderOptionIds.length - 1 || !isMyTurn}
                          aria-label="Bajar paso"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="q-options-grid">
              {question.type === 'epi_select' && !isAnswered && (
                <p className="q-helper-note">
                  Marca TODOS los Equipos de Protección Individual necesarios antes de confirmar:
                </p>
              )}
              {question.options.map((optText, idx) => {
                const optId = optionIds[idx];
                const chosenIds = activeChallenge.selectedOptionIds ?? selectedIds;
                const isSelected = isAnswered
                  ? chosenIds.includes(optId) ||
                    Boolean(activeChallenge.selectedIndices?.includes(idx))
                  : selectedIds.includes(optId);
                const isRightOption =
                  isAnswered &&
                  (Boolean(question.correctOptionIds?.includes(optId)) ||
                    question.correctIndices.includes(idx));
                let statusClass = '';
                if (isAnswered) {
                  if (isRightOption) statusClass = 'opt-correct-highlight';
                  else if (isSelected && !isRightOption) statusClass = 'opt-wrong-highlight';
                } else if (isSelected) {
                  statusClass = 'opt-selected';
                }

                return (
                  <button
                    key={optId}
                    type="button"
                    disabled={isAnswered || !isMyTurn}
                    onClick={() => handleToggleOption(optId)}
                    data-option-id={optId}
                    className={`q-option-btn ${statusClass}`}
                  >
                    <span className="q-opt-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="q-opt-text">{optText}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Checkbox de bonus por colaboración en equipo */}
          {!isAnswered && roomState.config.mode === 'teams' && (
            <label className="collab-bonus-check">
              <input
                type="checkbox"
                checked={collaborated}
                onChange={(e) => setCollaborated(e.target.checked)}
              />
              <span>
                El equipo ha debatido la decisión aplicando los roles del turno (+
                {roomState.config.scoring.colaboracionBonus} pts bonus colaboración)
              </span>
            </label>
          )}

          {/* Explicación Pedagógica Completa tras responder */}
          {isAnswered && (
            <div className={`pedagogical-box ${isCorrect ? 'ped-correct' : 'ped-wrong'}`}>
              <div className="ped-header">
                {isCorrect ? (
                  <>
                    <CheckCircle2 size={24} className="text-green" />
                    <div>
                      <h3>
                        ¡ACTUACIÓN PREVENTIVA CORRECTA! (+{activeChallenge.pointsAwarded ?? 0}{' '}
                        puntos)
                      </h3>
                      {activeChallenge.collaborationBonusAwarded && (
                        <span className="ped-bonus-tag">
                          Incluye +{roomState.config.scoring.colaboracionBonus} pts de Bonus por
                          Colaboración en Equipo
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle size={24} className="text-orange" />
                    <div>
                      <h3>ATENCIÓN PREVENTIVA: Revisemos la solución correcta</h3>
                      {(activeChallenge.retreatTiles ?? 0) > 0 ? (
                        <span className="text-orange" style={{ fontWeight: 800 }}>
                          ⚠️ Penalización: el equipo retrocede {activeChallenge.retreatTiles}{' '}
                          {activeChallenge.retreatTiles === 1 ? 'casilla' : 'casillas'} (hasta la #
                          {activeTeam?.position}). Se muestra la actuación segura en verde.
                        </span>
                      ) : (
                        <span>
                          Sin retroceso de casilla. Se ha iluminado en verde la actuación segura
                          para consolidar el aprendizaje.
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {activeChallenge.tileIndex === 48 && isCorrect && activeTeam?.finishOrder && (
                <div className="unlocked-badges-alert">
                  <Award size={20} />
                  <span>
                    🏁 ¡META #48 CONQUISTADA EN EL PUESTO #{activeTeam.finishOrder}! Los demás
                    participantes continúan hasta completar el recorrido.
                  </span>
                </div>
              )}

              {activeChallenge.unlockedBadges && activeChallenge.unlockedBadges.length > 0 && (
                <div className="unlocked-badges-alert">
                  <Award size={20} />
                  <span>
                    ¡Nueva Insignia 3D Desbloqueada:{' '}
                    {activeChallenge.unlockedBadges
                      .map((id) => BADGE_DEFINITIONS.find((b) => b.id === id)?.name ?? id)
                      .join(', ')}
                    !
                  </span>
                </div>
              )}

              <div className="ped-grid">
                <div className="ped-item">
                  <strong>
                    <BookOpen size={15} /> ¿Por qué es la solución correcta?
                  </strong>
                  <p>{question.explanation.whyCorrect}</p>
                </div>
                <div className="ped-item">
                  <strong>
                    <AlertTriangle size={15} /> Riesgo y Consecuencias:
                  </strong>
                  <p>
                    <em>Riesgo:</em> {question.explanation.riskIdentified} <br />
                    <em>Consecuencias:</em> {question.explanation.consequences}
                  </p>
                </div>
                <div className="ped-item">
                  <strong>
                    <ShieldCheck size={15} /> Medidas Preventivas Aplicables:
                  </strong>
                  <p>{question.explanation.preventiveMeasures}</p>
                </div>
                <div className="ped-item">
                  <strong>
                    <Scale size={15} /> Referencia Normativa PRL:
                  </strong>
                  <p>{question.explanation.legalReference}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie de acciones siempre visible */}
        <div className="q-footer-bar">
          {!isMyTurn ? (
            <button type="button" className="btn-secondary btn-lg" disabled>
              Modo observación · Responde {activeTeam?.name.split('(')[0].trim()}
            </button>
          ) : !isAnswered ? (
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={handleConfirm}
              disabled={question.type !== 'ordering' && selectedIds.length === 0}
            >
              Confirmar Decisión Preventiva
            </button>
          ) : (
            <button type="button" className="btn-primary btn-lg" onClick={nextTurn}>
              Continuar Partida → Siguiente Turno
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
