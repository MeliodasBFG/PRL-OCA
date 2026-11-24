import React, { useEffect, useState } from 'react';
import {
  Award,
  Compass,
  Dices,
  FastForward,
  Info,
  Maximize2,
  PauseCircle,
  Play,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BADGE_DEFINITIONS,
  BOARD_TILES,
  CHALLENGES_3D,
  INDUSTRIAL_ZONE_LABELS,
  PRL_CATEGORY_LABELS,
  TEAM_ROLE_INFO,
  TILE_TYPE_LABELS,
  TileDefinition,
  WrongAnswerPenalty,
  canPlayerActOnTeamTurn,
  getRoomParticipantStats,
} from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { BoardScene3D } from '../scenes/BoardScene3D';
import { Board2DFallback } from '../board/Board2DFallback';
import { QuestionModal } from '../components/QuestionModal';
import { ChallengeModal } from '../components/ChallengeModal';
import {
  enterGameLandscapeMode,
  getContrastTextColor,
  isMobileTouchDevice,
  isPortraitViewport,
} from '../utils/mobileOrientation';

function buildTileInspectionDetails(
  tile: TileDefinition,
  wrongAnswerPenalty: WrongAnswerPenalty
): { titleTag: string; explanation: string; consequenceHint?: string } {
  const categoryLabel = PRL_CATEGORY_LABELS[tile.category];
  const penaltyText =
    wrongAnswerPenalty === 0
      ? 'sin retroceso de casilla'
      : `retroceso de ${wrongAnswerPenalty} ${wrongAnswerPenalty === 1 ? 'casilla' : 'casillas'}`;

  if (tile.type === 'salida') {
    return {
      titleTag: 'Inicio del recorrido',
      explanation:
        'Casilla de salida en el Pórtico de Acceso Seguro. Todos los equipos comienzan la partida desde este punto.',
    };
  }

  if (tile.type === 'meta') {
    return {
      titleTag: 'Casilla Final (#48)',
      explanation:
        'Meta Cero Accidentes. Al alcanzar la casilla #48 y superar la validación preventiva final se proclama al equipo ganador y se genera el diagnóstico PRL.',
    };
  }

  if (tile.type === 'desafio') {
    const ch = CHALLENGES_3D.find((c) => c.id === tile.challengeId);
    if (ch) {
      return {
        titleTag: `Desafío 3D #${ch.number} · ${ch.points} pts · ${ch.timeSeconds}s`,
        explanation: ch.instructions,
        consequenceHint: `Inspección interactiva 3D: marca ${ch.requiredSelections} elementos en el escenario. Normativa: ${ch.legalReference.replace(/\.+$/, '')}.`,
      };
    }
  }

  if (tile.specialEffect) {
    const effects: string[] = [];
    if (tile.specialEffect.targetTile) {
      effects.push(`Salta a casilla #${tile.specialEffect.targetTile}`);
    }
    if (tile.specialEffect.moveDelta) {
      effects.push(
        tile.specialEffect.moveDelta > 0
          ? `Avanza +${tile.specialEffect.moveDelta} casillas`
          : `Retrocede ${Math.abs(tile.specialEffect.moveDelta)} casillas`
      );
    }
    if (tile.specialEffect.bonusPoints) {
      effects.push(`+${tile.specialEffect.bonusPoints} pts extra`);
    }
    if (tile.specialEffect.extraRoll) {
      effects.push('Concede tirada adicional');
    }
    if (tile.specialEffect.skipTurn) {
      effects.push('Pausa preventiva de 1 turno');
    }
    return {
      titleTag: tile.type === 'prevencion' ? 'Oca Preventiva' : 'Casilla Especial',
      explanation: tile.specialEffect.explanation,
      consequenceHint: effects.length > 0 ? `Efecto al caer: ${effects.join(' · ')}.` : undefined,
    };
  }

  const actionByType: Partial<Record<TileDefinition['type'], string>> = {
    pregunta: `Al caer aquí se plantea una pregunta de prevención centrada en ${categoryLabel}.`,
    peligro: `Inspección de riesgo laboral: deberás detectar un peligro real o responder sobre ${categoryLabel}.`,
    epi: `Control de EPI: tendrás que seleccionar los Equipos de Protección Individual adecuados (${categoryLabel}).`,
    senalizacion: `Reconocimiento de señales de seguridad normalizadas (RD 485/1997) sobre ${categoryLabel}.`,
    accidente: `Estudio de un accidente laboral real para identificar fallos preventivos (${categoryLabel}).`,
    emergencia: `Protocolo de actuación ante emergencias, evacuación o primeros auxilios (${categoryLabel}).`,
    investigacion: `Investigación técnica de causas raíz para evitar la repetición de incidentes (${categoryLabel}).`,
  };

  return {
    titleTag: TILE_TYPE_LABELS[tile.type],
    explanation:
      actionByType[tile.type] ??
      `Prueba formativa de Prevención de Riesgos Laborales vinculada a ${categoryLabel}.`,
    consequenceHint: `Si aciertas sumas puntos y mantienes tu racha; si fallas aplica la regla de sala (${penaltyText}).`,
  };
}

export const GameScreen: React.FC = () => {
  const {
    roomState,
    cameraView,
    cameraResetKey,
    cameraZoomDelta,
    graphicsQuality,
    board2DMode,
    reducedMotion,
    isRollingAnimation,
    isTokenMoving,
    challengeModalReady,
    playerId,
    isTeacher,
    projectorMode,
    showTeacherPanel,
    showQRModal,
    showSettingsModal,
    showInstructionsModal,
    errorMessage,
    rollDice,
    nextTurn,
    resetCamera,
    zoomCamera,
    notifyTokenArrived,
    runTeacherCommand,
    clearError,
  } = useGameStore();

  const [inspectedTile, setInspectedTile] = useState<TileDefinition | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [isMobileTouch, setIsMobileTouch] = useState(() => isMobileTouchDevice());
  const [isPortrait, setIsPortrait] = useState(() => isPortraitViewport());
  const [landscapeHintDismissed, setLandscapeHintDismissed] = useState(false);
  const [autoLandscapeTriedOnTouch, setAutoLandscapeTriedOnTouch] = useState(false);

  useEffect(() => {
    void enterGameLandscapeMode();
    const updateViewportFlags = () => {
      setIsMobileTouch(isMobileTouchDevice());
      setIsPortrait(isPortraitViewport());
    };
    window.addEventListener('resize', updateViewportFlags);
    window.addEventListener('orientationchange', updateViewportFlags);
    return () => {
      window.removeEventListener('resize', updateViewportFlags);
      window.removeEventListener('orientationchange', updateViewportFlags);
    };
  }, []);

  const shouldClearInspector = Boolean(
    isRollingAnimation ||
      isTokenMoving ||
      roomState?.phase === 'showing_feedback' ||
      roomState?.activeChallenge
  );

  useEffect(() => {
    if (shouldClearInspector) {
      setInspectedTile(null);
    }
  }, [shouldClearInspector]);

  if (!roomState) return null;

  const activeTeam = roomState.teams[roomState.activeTeamIndex] ?? roomState.teams[0];
  const currentTile =
    BOARD_TILES.find((t) => t.index === activeTeam?.position) ?? BOARD_TILES[0];
  const diceValues =
    roomState.lastDiceRoll?.dice ?? (roomState.config.diceMode === '2d6' ? [6, 6] : [6]);

  const sortedStandings = [...roomState.teams].sort((a, b) => {
    if (b.position !== a.position) return b.position - a.position;
    return b.score - a.score;
  });
  const participantStats = getRoomParticipantStats(roomState);
  const turnAuth = canPlayerActOnTeamTurn(roomState, playerId);
  const isMyTurn = turnAuth.allowed;
  const activePlayerId = turnAuth.activePlayerId ?? roomState.activePlayerId ?? null;
  const activePlayer = activePlayerId
    ? roomState.players.find((p) => p.id === activePlayerId)
    : undefined;

  const anyModalOpen = Boolean(
    (roomState.phase === 'showing_feedback' &&
      challengeModalReady &&
      !isRollingAnimation &&
      !isTokenMoving) ||
      (roomState.activeChallenge &&
        challengeModalReady &&
        !isRollingAnimation &&
        !isTokenMoving) ||
      showTeacherPanel ||
      showQRModal ||
      showSettingsModal ||
      showInstructionsModal
  );

  const inspectedDetails = inspectedTile
    ? buildTileInspectionDetails(inspectedTile, roomState.config.wrongAnswerPenalty)
    : null;
  const inspectedOccupants = inspectedTile
    ? roomState.teams.filter((t) => t.position === inspectedTile.index)
    : [];

  const handleFirstMobileViewportInteraction = () => {
    if (isMobileTouch && isPortrait && !autoLandscapeTriedOnTouch && !landscapeHintDismissed) {
      setAutoLandscapeTriedOnTouch(true);
      void enterGameLandscapeMode();
    }
  };

  return (
    <main
      className="game-screen-layout"
      onPointerDown={handleFirstMobileViewportInteraction}
    >
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
            cameraResetKey={cameraResetKey}
            cameraZoomDelta={cameraZoomDelta}
            graphicsQuality={graphicsQuality}
            reducedMotion={reducedMotion}
            hideHtmlOverlays={anyModalOpen}
            onSelectTile={(tile) => setInspectedTile(tile)}
            onActiveTokenArrive={notifyTokenArrived}
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
              <h2 style={{ color: activeTeam.hexColor }}>
                {activeTeam.name}
                {activePlayer ? ` · Lanza: ${activePlayer.name}` : ''}
              </h2>
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

        {/* Aviso no bloqueante para poner el móvil en horizontal cuando no está en apaisado */}
        {isMobileTouch &&
          isPortrait &&
          !landscapeHintDismissed &&
          !anyModalOpen &&
          !isRollingAnimation &&
          !isTokenMoving && (
            <div className="mobile-landscape-prompt" role="status">
              <Smartphone size={16} className="text-yellow" />
              <span>Mejor en horizontal 3D</span>
              <button
                type="button"
                className="btn-landscape-activate"
                onClick={() => void enterGameLandscapeMode()}
              >
                Girar / Pantalla completa
              </button>
              <button
                type="button"
                className="btn-landscape-dismiss"
                onClick={() => setLandscapeHintDismissed(true)}
                aria-label="Ocultar aviso de orientación"
              >
                <X size={14} />
              </button>
            </div>
          )}

        {/* Controles flotantes de Zoom, Cámara y Pantalla Completa Horizontal */}
        {!board2DMode && (
          <div className="viewport-camera-controls" aria-label="Controles rápidos de cámara 3D">
            <button
              type="button"
              className="cam-ctrl-btn"
              onClick={() => zoomCamera(1)}
              title="Acercar cámara (Zoom +)"
              aria-label="Acercar cámara"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              className="cam-ctrl-btn"
              onClick={() => zoomCamera(-1)}
              title="Alejar cámara (Zoom -)"
              aria-label="Alejar cámara"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              className="cam-ctrl-btn"
              onClick={resetCamera}
              title="Recuperar perspectiva isométrica general"
              aria-label="Recuperar perspectiva original"
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              className="cam-ctrl-btn show-mobile-only"
              onClick={() => void enterGameLandscapeMode()}
              title="Activar pantalla completa horizontal"
              aria-label="Activar vista horizontal en pantalla completa"
            >
              <Maximize2 size={17} />
            </button>
          </div>
        )}

        {/* Banner Cinematográfico mientras los dados ruedan o la ficha avanza casilla por casilla */}
        {(isRollingAnimation || isTokenMoving) && (
          <div className="cinematic-movement-banner" role="status" aria-live="polite">
            <div className="cinematic-spinner" />
            <div>
              {isRollingAnimation ? (
                <>
                  <strong>🎲 Lanzando dados 3D en el servidor...</strong>
                  <span>Calculando puntuación autoritativa</span>
                </>
              ) : (
                <>
                  <strong>
                    🎲 Resultado: {roomState.lastDiceRoll?.dice.join(' + ')} (
                    {roomState.lastDiceRoll?.total}) · ¡Avanzando casilla por casilla!
                  </strong>
                  <span>
                    {activeTeam?.name.split('(')[0].trim()} se desplaza hacia la casilla #
                    {activeTeam?.position} ({currentTile.name})
                  </span>
                </>
              )}
            </div>
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

        {/* Tarjeta de Casilla Especial / Oca Preventiva una vez que la ficha ha llegado a destino */}
        {roomState.phase === 'showing_feedback' &&
          !roomState.activeChallenge &&
          challengeModalReady &&
          !isRollingAnimation &&
          !isTokenMoving && (
            <div
              className="special-tile-feedback-layer"
              role="dialog"
              aria-modal="true"
              aria-label={`Casilla Especial Activada: ${currentTile.name}`}
            >
              <div className="special-tile-feedback-card modal-animate-in">
                <div className="special-card-head">
                  <Sparkles size={22} className="text-yellow" />
                  <h3>¡Casilla Especial Activada: {currentTile.name}!</h3>
                </div>
                <p>
                  {roomState.lastDiceRoll?.specialExplanation ??
                    currentTile.specialEffect?.explanation ??
                    currentTile.subtitle}
                </p>
                {isMyTurn ? (
                  <button
                    type="button"
                    className="btn-primary btn-lg special-continue-btn"
                    onClick={nextTurn}
                  >
                    <FastForward size={18} /> Continuar Recorrido
                  </button>
                ) : (
                  <button type="button" className="btn-secondary btn-lg" disabled>
                    Esperando a{' '}
                    {activePlayer
                      ? `${activePlayer.name} (${activeTeam?.name.split('(')[0].trim()})`
                      : activeTeam?.name.split('(')[0].trim()}
                    ...
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Tarjeta informativa clara al pulsar cualquier casilla del tablero 3D/2D */}
        {inspectedTile &&
          inspectedDetails &&
          !anyModalOpen &&
          !isRollingAnimation &&
          !isTokenMoving && (
            <div
              className="tile-inspector-layer"
              onClick={() => setInspectedTile(null)}
              role="dialog"
              aria-label={`Información de la casilla ${inspectedTile.index}`}
            >
              <div
                className="tile-inspector-drawer modal-animate-in"
                style={{ borderColor: inspectedTile.color }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="inspector-head">
                  <span
                    className="inspector-num"
                    style={{
                      background: inspectedTile.color,
                      color: getContrastTextColor(inspectedTile.color),
                    }}
                  >
                    Casilla #{inspectedTile.index}
                  </span>
                  <strong>{inspectedTile.name}</strong>
                  <button
                    type="button"
                    className="btn-ghost-sm inspector-close-btn"
                    onClick={() => setInspectedTile(null)}
                    aria-label="Cerrar detalle de casilla"
                  >
                    <X size={14} /> Cerrar
                  </button>
                </div>

                <p className="inspector-sub">{inspectedTile.subtitle}</p>

                <div className="inspector-purpose-box">
                  <div className="inspector-purpose-title">
                    <Info size={14} className="text-yellow" />
                    <strong>¿De qué trata esta casilla? · {inspectedDetails.titleTag}</strong>
                  </div>
                  <p className="inspector-purpose-text">{inspectedDetails.explanation}</p>
                  {inspectedDetails.consequenceHint && (
                    <p className="inspector-effect-hint">{inspectedDetails.consequenceHint}</p>
                  )}
                </div>

                <div className="inspector-tags">
                  <span>Zona: {INDUSTRIAL_ZONE_LABELS[inspectedTile.zone]}</span>
                  <span>Tipo: {TILE_TYPE_LABELS[inspectedTile.type]}</span>
                  <span>Categoría: {PRL_CATEGORY_LABELS[inspectedTile.category]}</span>
                </div>

                {inspectedOccupants.length > 0 && (
                  <div className="inspector-occupants">
                    <span>Equipos aquí ahora:</span>
                    {inspectedOccupants.map((team) => (
                      <span
                        key={team.id}
                        className="inspector-occupant-chip"
                        style={{ backgroundColor: team.hexColor }}
                      >
                        {team.name.split('(')[0].trim()}
                      </span>
                    ))}
                  </div>
                )}
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

          <div className="dock-main-buttons">
            {!projectorMode && roomState.phase === 'waiting_roll' && (
              <button
                type="button"
                className={`btn-roll-dice-3d ${!isMyTurn ? 'turn-locked' : ''}`}
                disabled={
                  !isMyTurn || isRollingAnimation || isTokenMoving || roomState.status !== 'playing'
                }
                onClick={isMyTurn ? rollDice : undefined}
                title={
                  isMyTurn
                    ? 'Lanzar los dados en tu turno'
                    : turnAuth.reason ?? `Es el turno de ${activeTeam?.name.split('(')[0].trim()}`
                }
              >
                <Dices size={24} />
                <div>
                  <strong>
                    {isRollingAnimation
                      ? 'LANZANDO DADOS 3D...'
                      : isTokenMoving
                      ? 'AVANZANDO FICHA...'
                      : !isMyTurn
                      ? 'Esperando tu turno'
                      : 'LANZAR DADOS 3D'}
                  </strong>
                  <span>
                    {isMyTurn
                      ? `Tu turno · ${activeTeam?.name.split('(')[0].trim()}`
                      : `Turno de ${
                          activePlayer
                            ? `${activePlayer.name} (${activeTeam?.name.split('(')[0].trim()})`
                            : activeTeam?.name.split('(')[0].trim()
                        }`}
                  </span>
                </div>
              </button>
            )}

            <button
              type="button"
              className="btn-mobile-drawer-toggle show-mobile-only"
              onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
            >
              <Trophy size={18} />
              <span>{mobilePanelOpen ? 'Ocultar' : 'Clasificación'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fondo clicable para cerrar el cajón de clasificación en móvil */}
      {mobilePanelOpen && (
        <div
          className="mobile-drawer-backdrop show-mobile-only"
          onClick={() => setMobilePanelOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel Lateral de Clasificación, Insignias 3D y Registro en Tiempo Real */}
      <aside className={`game-sidebar-hud ${mobilePanelOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-section">
          <div className="sidebar-title-row">
            <Trophy size={17} className="text-yellow" />
            <h3>Clasificación en Vivo</h3>
            <span className="turn-tile-pill" title="Participantes conectados / máximo">
              <Users size={13} /> {participantStats.connectedCount}/{participantStats.maxPlayers}
            </span>
            <button
              type="button"
              className="btn-ghost-sm show-mobile-only sidebar-mobile-close"
              onClick={() => setMobilePanelOpen(false)}
              aria-label="Cerrar clasificación"
            >
              <X size={14} /> Cerrar
            </button>
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
            Pulsa cualquier casilla 3D para consultar su categoría PRL o usa los controles de
            zoom/rotación para explorar el tablero.
          </span>
        </div>
      </aside>

      {/* Ventanas Modales de Pregunta o Desafío 3D Interactivo */}
      <QuestionModal />
      <ChallengeModal />
    </main>
  );
};
