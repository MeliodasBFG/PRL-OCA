import React, { useState } from 'react';
import {
  Award,
  Compass,
  Dices,
  FastForward,
  Info,
  PauseCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import {
  BADGE_DEFINITIONS,
  BOARD_TILES,
  INDUSTRIAL_ZONE_LABELS,
  PRL_CATEGORY_LABELS,
  TEAM_ROLE_INFO,
  TILE_TYPE_LABELS,
  TileDefinition,
} from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { BoardScene3D } from '../scenes/BoardScene3D';
import { Board2DFallback } from '../board/Board2DFallback';
import { QuestionModal } from '../components/QuestionModal';
import { ChallengeModal } from '../components/ChallengeModal';

export const GameScreen: React.FC = () => {
  const {
    roomState,
    cameraView,
    graphicsQuality,
    board2DMode,
    reducedMotion,
    isRollingAnimation,
    isTeacher,
    projectorMode,
    errorMessage,
    rollDice,
    nextTurn,
    runTeacherCommand,
    clearError,
  } = useGameStore();

  const [inspectedTile, setInspectedTile] = useState<TileDefinition | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  if (!roomState) return null;

  const activeTeam = roomState.teams[roomState.activeTeamIndex] ?? roomState.teams[0];
  const currentTile =
    BOARD_TILES.find((t) => t.index === activeTeam?.position) ?? BOARD_TILES[0];
  const diceValues = roomState.lastDiceRoll?.dice ?? (roomState.config.diceMode === '2d6' ? [6, 6] : [6]);

  const sortedStandings = [...roomState.teams].sort((a, b) => {
    if (b.position !== a.position) return b.position - a.position;
    return b.score - a.score;
  });

  return (
    <main className="game-screen-layout">
      {/* Lienzo 3D Principal o Alternativa 2D */}
      <div className="game-viewport-area">
        {board2DMode ? (
          <Board2DFallback
            teams={roomState.teams}
            activeTeamId={activeTeam?.id}
            onSelectTile={(tile) => setInspectedTile(tile)}
          />
        ) : (
          <BoardScene3D
            teams={roomState.teams}
            activeTeamIndex={roomState.activeTeamIndex}
            diceValues={diceValues}
            isRolling={isRollingAnimation}
            cameraView={cameraView}
            graphicsQuality={graphicsQuality}
            reducedMotion={reducedMotion}
            onSelectTile={(tile) => setInspectedTile(tile)}
          />
        )}

        {/* Banner Superior de Turno Activo y Roles Rotativos */}
        {activeTeam && (
          <div
            className="hud-turn-banner"
            style={{ borderTop: `4px solid ${activeTeam.hexColor}` }}
          >
            <div className="hud-turn-main">
              <span className="turn-counter-pill">TURNO #{roomState.turnNumber}</span>
              <h2 style={{ color: activeTeam.hexColor }}>{activeTeam.name}</h2>
              <span className="turn-tile-pill">
                Casilla #{activeTeam.position}/48 · {currentTile.name} (
                {INDUSTRIAL_ZONE_LABELS[currentTile.zone]})
              </span>
            </div>

            {activeTeam.currentRoles.length > 0 && (
              <div className="hud-roles-strip">
                <Users size={14} />
                {activeTeam.currentRoles.map((rAssign) =>
                  rAssign.roles.map((r) => (
                    <span key={`${rAssign.playerId}_${r}`} className="hud-role-chip">
                      <strong>{TEAM_ROLE_INFO[r].title}:</strong> {rAssign.playerName}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Aviso si la partida está en Pausa */}
        {roomState.status === 'paused' && (
          <div className="paused-overlay-banner">
            <PauseCircle size={28} className="text-yellow" />
            <div>
              <strong>PARTIDA EN PAUSA POR EL DOCENTE</strong>
              <p>El cronómetro y los turnos están detenidos temporalmente.</p>
            </div>
            {isTeacher && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => runTeacherCommand({ kind: 'RESUME_GAME' })}
              >
                <Play size={16} /> Reanudar Ahora
              </button>
            )}
          </div>
        )}

        {/* Error Toast si aplica */}
        {errorMessage && (
          <div className="hud-error-toast" onClick={clearError}>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tarjeta de Casilla Especial / Oca Preventiva cuando no hay pregunta abierta */}
        {roomState.phase === 'showing_feedback' && !roomState.activeChallenge && (
          <div className="special-tile-feedback-card">
            <div className="special-card-head">
              <Sparkles size={22} className="text-yellow" />
              <h3>¡Casilla Especial Activada: {currentTile.name}!</h3>
            </div>
            <p>
              {roomState.lastDiceRoll?.specialExplanation ??
                currentTile.specialEffect?.explanation ??
                currentTile.subtitle}
            </p>
            <button type="button" className="btn-primary btn-lg" onClick={nextTurn}>
              <FastForward size={18} /> Continuar Recorrido
            </button>
          </div>
        )}

        {/* Tarjeta flotante al pulsar cualquier casilla del tablero 3D/2D */}
        {inspectedTile && (
          <div className="tile-inspector-drawer" style={{ borderColor: inspectedTile.color }}>
            <div className="inspector-head">
              <span className="inspector-num" style={{ background: inspectedTile.color }}>
                Casilla #{inspectedTile.index}
              </span>
              <strong>{inspectedTile.name}</strong>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setInspectedTile(null)}
              >
                Cerrar
              </button>
            </div>
            <p className="inspector-sub">{inspectedTile.subtitle}</p>
            <div className="inspector-tags">
              <span>Zona: {INDUSTRIAL_ZONE_LABELS[inspectedTile.zone]}</span>
              <span>Tipo: {TILE_TYPE_LABELS[inspectedTile.type]}</span>
              <span>Categoría: {PRL_CATEGORY_LABELS[inspectedTile.category]}</span>
            </div>
          </div>
        )}

        {/* Barra Inferior de Acción: Lanzar Dados 3D y Resultado del Servidor */}
        <div className="hud-bottom-dock">
          <div className="dice-status-box">
            <div className="dice-faces-row">
              {diceValues.map((v, i) => (
                <div key={i} className={`die-hud-cube ${isRollingAnimation ? 'spinning' : ''}`}>
                  {isRollingAnimation ? '?' : v}
                </div>
              ))}
            </div>
            <div className="dice-text-meta">
              <strong>
                {roomState.lastDiceRoll
                  ? `Última tirada: ${roomState.lastDiceRoll.dice.join(' + ')} = ${
                      roomState.lastDiceRoll.total
                    }`
                  : `Dados 3D (${roomState.config.diceMode.toUpperCase()}) listos`}
              </strong>
              <span>Autoridad del servidor verificada</span>
            </div>
          </div>

          {!projectorMode && (
            <div className="dock-main-buttons">
              {roomState.phase === 'waiting_roll' && (
                <button
                  type="button"
                  className="btn-roll-dice-3d"
                  disabled={isRollingAnimation || roomState.status !== 'playing'}
                  onClick={rollDice}
                >
                  <Dices size={24} />
                  <div>
                    <strong>
                      {isRollingAnimation ? 'LANZANDO DADOS 3D...' : 'LANZAR DADOS 3D'}
                    </strong>
                    <span>Turno de {activeTeam?.name.split('(')[0].trim()}</span>
                  </div>
                </button>
              )}

              <button
                type="button"
                className="btn-mobile-drawer-toggle show-mobile-only"
                onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
              >
                <Trophy size={18} />
                <span>{mobilePanelOpen ? 'Ocultar Panel' : 'Clasificación'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panel Lateral de Clasificación, Insignias 3D y Registro en Tiempo Real */}
      <aside className={`game-sidebar-hud ${mobilePanelOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-section">
          <div className="sidebar-title-row">
            <Trophy size={17} className="text-yellow" />
            <h3>Clasificación en Vivo</h3>
          </div>

          <div className="standings-list">
            {sortedStandings.map((team, rank) => {
              const progressPct = Math.round((team.position / 48) * 100);
              return (
                <div
                  key={team.id}
                  className={`standing-card ${
                    team.id === activeTeam?.id ? 'standing-active' : ''
                  }`}
                  style={{ borderLeft: `4px solid ${team.hexColor}` }}
                >
                  <div className="standing-top">
                    <span className="standing-rank">#{rank + 1}</span>
                    <strong className="standing-name">{team.name.split('(')[0].trim()}</strong>
                    <span className="standing-score">{team.score} pts</span>
                  </div>

                  <div className="standing-progress-track">
                    <div
                      className="standing-progress-fill"
                      style={{ width: `${progressPct}%`, background: team.hexColor }}
                    />
                  </div>

                  <div className="standing-meta-row">
                    <span>Casilla #{team.position}/48</span>
                    <span>Aciertos: {team.correctAnswers}</span>
                    <span>Racha: {team.streak}🔥</span>
                  </div>

                  {team.badges.length > 0 && (
                    <div className="standing-badges-row">
                      {team.badges.map((bId) => {
                        const bDef = BADGE_DEFINITIONS.find((b) => b.id === bId);
                        return (
                          <span
                            key={bId}
                            className="mini-badge-chip"
                            style={{ borderColor: bDef?.color }}
                            title={bDef?.description}
                          >
                            <Award size={12} /> {bDef?.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bitácora en Tiempo Real de la Partida */}
        <div className="sidebar-section logs-section">
          <div className="sidebar-title-row">
            <Compass size={17} className="text-blue" />
            <h3>Registro Preventivo en Vivo</h3>
          </div>
          <div className="live-logs-scroll">
            {roomState.logs.slice(0, 18).map((log) => (
              <div key={log.id} className={`log-item log-${log.type}`}>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer-tip">
          <Info size={14} />
          <span>
            Pulsa cualquier casilla 3D para consultar su categoría PRL o usa la rueda/pellizco
            para acercar la cámara.
          </span>
        </div>
      </aside>

      {/* Ventanas Modales de Pregunta o Desafío 3D Interactivo */}
      <QuestionModal />
      <ChallengeModal />
    </main>
  );
};
