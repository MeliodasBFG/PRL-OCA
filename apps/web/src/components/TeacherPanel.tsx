import React, { useState } from 'react';
import {
  Award,
  Eye,
  FastForward,
  Pause,
  Play,
  RefreshCw,
  Sliders,
  Trash2,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react';
import { BOARD_TILES, CHALLENGES_3D, Difficulty, WrongAnswerPenalty } from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';

export const TeacherPanel: React.FC = () => {
  const {
    showTeacherPanel,
    roomState,
    questionBank,
    setShowTeacherPanel,
    setProjectorMode,
    runTeacherCommand,
  } = useGameStore();

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    questionBank[0]?.id ?? 'q_cb_01'
  );
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    CHALLENGES_3D[4]?.id ?? 'challenge_5'
  );

  if (!showTeacherPanel || !roomState) return null;

  const isPaused = roomState.status === 'paused';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tp-title">
      <div className="modal-card teacher-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <Sliders size={22} className="text-yellow" />
            <h2 id="tp-title">Panel de Administración Docente (Control Total)</h2>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setShowTeacherPanel(false)}
            aria-label="Cerrar panel docente"
          >
            <X size={20} />
          </button>
        </div>

        <div className="teacher-panel-body">
          {/* 1. Control del Flujo de la Partida */}
          <section className="tp-section">
            <h3>1. Estado de la Sala y Control de Turnos</h3>
            <div className="tp-btn-row">
              {roomState.status === 'lobby' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => runTeacherCommand({ kind: 'START_GAME' })}
                >
                  <Play size={16} /> Iniciar Partida
                </button>
              )}

              {(roomState.status === 'playing' || roomState.status === 'paused') && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    runTeacherCommand({
                      kind: isPaused ? 'RESUME_GAME' : 'PAUSE_GAME',
                    })
                  }
                >
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                  <span>{isPaused ? 'Reanudar Partida' : 'Pausar Partida'}</span>
                </button>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => runTeacherCommand({ kind: 'FORCE_NEXT_TURN' })}
              >
                <FastForward size={16} /> Cambiar Turno
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setProjectorMode(true)}
              >
                <Eye size={16} /> Activar Modo Proyección Aula
              </button>

              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  runTeacherCommand({ kind: 'END_GAME' });
                  setShowTeacherPanel(false);
                }}
              >
                <Trophy size={16} /> Finalizar y Mostrar Clasificación
              </button>
            </div>
          </section>

          {/* 2. Control Manual de Equipos (Posición de Fichas y Puntuaciones) */}
          <section className="tp-section">
            <h3>2. Control de Equipos (Avance Manual de Fichas y Ajuste de Puntos)</h3>
            <div className="tp-teams-table">
              {roomState.teams.map((team) => (
                <div key={team.id} className="tp-team-row">
                  <div className="tp-team-info">
                    <span className="team-dot" style={{ background: team.hexColor }} />
                    <strong>{team.name}</strong>
                    <span className="tp-badge-meta">
                      Casilla #{team.position} · {team.score} pts
                    </span>
                  </div>

                  <div className="tp-team-controls">
                    <label>
                      Mover a casilla:
                      <select
                        value={team.position}
                        onChange={(e) =>
                          runTeacherCommand({
                            kind: 'MOVE_TEAM',
                            teamId: team.id,
                            targetTile: Number(e.target.value),
                          })
                        }
                      >
                        {BOARD_TILES.map((t) => (
                          <option key={t.index} value={t.index}>
                            #{t.index} - {t.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="tp-score-btns">
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() =>
                          runTeacherCommand({
                            kind: 'ADJUST_SCORE',
                            teamId: team.id,
                            delta: -10,
                          })
                        }
                      >
                        -10 pts
                      </button>
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() =>
                          runTeacherCommand({
                            kind: 'ADJUST_SCORE',
                            teamId: team.id,
                            delta: 10,
                          })
                        }
                      >
                        +10 pts
                      </button>
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() =>
                          runTeacherCommand({
                            kind: 'ADJUST_SCORE',
                            teamId: team.id,
                            delta: 25,
                          })
                        }
                      >
                        +25 pts
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Control de Preguntas en Vivo */}
          <section className="tp-section">
            <h3>3. Control de Preguntas y Retos en Tiempo Real</h3>
            <div className="tp-btn-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => runTeacherCommand({ kind: 'SKIP_QUESTION' })}
              >
                Saltar / Cambiar Pregunta
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => runTeacherCommand({ kind: 'REPEAT_QUESTION' })}
              >
                <RefreshCw size={15} /> Repetir Pregunta Actual
              </button>
            </div>

            <div className="tp-force-question-row">
              <select
                value={selectedQuestionId}
                onChange={(e) => setSelectedQuestionId(e.target.value)}
                aria-label="Seleccionar pregunta del banco para lanzar"
              >
                {questionBank.map((q) => (
                  <option key={q.id} value={q.id}>
                    [{q.difficulty.toUpperCase()}] {q.title} ({q.points} pts)
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  runTeacherCommand({
                    kind: 'FORCE_QUESTION',
                    questionId: selectedQuestionId,
                  });
                  setShowTeacherPanel(false);
                }}
              >
                Lanzar Pregunta Seleccionada
              </button>
            </div>

            <div className="tp-force-question-row">
              <select
                value={selectedChallengeId}
                onChange={(e) => setSelectedChallengeId(e.target.value)}
                aria-label="Seleccionar Desafío 3D Interactivo para lanzar"
              >
                {CHALLENGES_3D.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    [DESAFÍO 3D #{ch.number}] {ch.title} ({ch.points} pts)
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  runTeacherCommand({
                    kind: 'FORCE_CHALLENGE',
                    challengeId: selectedChallengeId,
                  });
                  setShowTeacherPanel(false);
                }}
              >
                Lanzar Desafío 3D
              </button>
            </div>
          </section>

          {/* 4. Parámetros de Dados, Dificultad, Tiempos y Puntuaciones */}
          <section className="tp-section">
            <h3>4. Configuración de Dados, Dificultades, Tiempos y Puntos</h3>
            <div className="tp-config-grid">
              <label>
                Modalidad de Dados:
                <select
                  value={roomState.config.diceMode}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: { diceMode: e.target.value as '1d6' | '2d6' },
                    })
                  }
                >
                  <option value="1d6">1 Dado de 6 caras (1D6)</option>
                  <option value="2d6">2 Dados de 6 caras (2D6)</option>
                </select>
              </label>

              <label>
                Filtro de Dificultad:
                <select
                  value={roomState.config.difficultyFilter}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        difficultyFilter: e.target.value as Difficulty | 'todas',
                      },
                    })
                  }
                >
                  <option value="todas">Todas (Fácil, Intermedio y Avanzado)</option>
                  <option value="facil">Solo Nivel Fácil</option>
                  <option value="intermedio">Solo Nivel Intermedio</option>
                  <option value="avanzado">Solo Nivel Avanzado</option>
                </select>
              </label>

              <label>
                Si se falla una pregunta:
                <select
                  value={roomState.config.wrongAnswerPenalty ?? 0}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        wrongAnswerPenalty: Number(e.target.value) as WrongAnswerPenalty,
                      },
                    })
                  }
                >
                  <option value={0}>No pasa nada (se mantiene en su casilla)</option>
                  <option value={1}>Retroceder 1 casilla</option>
                  <option value={2}>Retroceder 2 casillas</option>
                </select>
              </label>

              <label>
                Tiempo Fácil (s):
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={roomState.config.timers.facil}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        timers: {
                          ...roomState.config.timers,
                          facil: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>

              <label>
                Tiempo Intermedio (s):
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={roomState.config.timers.intermedio}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        timers: {
                          ...roomState.config.timers,
                          intermedio: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>

              <label>
                Tiempo Avanzado (s):
                <input
                  type="number"
                  min={10}
                  max={240}
                  value={roomState.config.timers.avanzado}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        timers: {
                          ...roomState.config.timers,
                          avanzado: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>

              <label>
                Tiempo Desafío 3D (s):
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={roomState.config.timers.desafio}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        timers: {
                          ...roomState.config.timers,
                          desafio: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>

              <label>
                Puntos Fácil:
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={roomState.config.scoring.facil}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        scoring: {
                          ...roomState.config.scoring,
                          facil: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>

              <label>
                Puntos Desafío 3D:
                <input
                  type="number"
                  min={10}
                  max={200}
                  value={roomState.config.scoring.desafio}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        scoring: {
                          ...roomState.config.scoring,
                          desafio: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>

              <label>
                Incorporaciones tardías:
                <select
                  value={roomState.config.allowLateJoin ? 'allow' : 'reconnect_only'}
                  onChange={(e) =>
                    runTeacherCommand({
                      kind: 'UPDATE_CONFIG',
                      partialConfig: {
                        allowLateJoin: e.target.value === 'allow',
                      },
                    })
                  }
                >
                  <option value="reconnect_only">Solo reconexión de alumnos registrados</option>
                  <option value="allow">Permitir nuevos alumnos con partida iniciada</option>
                </select>
              </label>
            </div>
          </section>

          {/* 5. Gestión de Participantes Conectados */}
          <section className="tp-section">
            <h3>
              5. Participantes Conectados (
              {roomState.players.filter((p) => !p.isTeacher && !p.isSpectator).length} /{' '}
              {roomState.config.maxPlayers})
            </h3>
            <div className="tp-players-list">
              {roomState.players
                .filter((p) => !p.isTeacher && !p.isSpectator)
                .map((player) => (
                  <div key={player.id} className="tp-player-row">
                    <span className="tp-player-name">
                      <UserCheck size={15} /> {player.name}
                    </span>
                    <div className="tp-player-actions">
                      <select
                        value={player.teamId}
                        onChange={(e) =>
                          runTeacherCommand({
                            kind: 'ASSIGN_TEAM',
                            playerId: player.id,
                            teamId: e.target.value,
                          })
                        }
                        aria-label={`Cambiar equipo de ${player.name}`}
                      >
                        {roomState.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-icon-only danger"
                        title="Expulsar participante"
                        onClick={() =>
                          runTeacherCommand({
                            kind: 'KICK_PLAYER',
                            playerId: player.id,
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
