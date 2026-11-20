import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit2,
  Play,
  QrCode,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wifi,
} from 'lucide-react';
import {
  TEAM_ROLE_INFO,
  getRoomParticipantStats,
  isPlayerCountedAsParticipant,
} from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { LobbyScene3D } from '../scenes/LobbyScene3D';
import { mpClient } from '../multiplayer/wsClient';

export const LobbyScreen: React.FC = () => {
  const {
    roomState,
    playerId,
    isTeacher,
    connectionStatus,
    isRemoteSession,
    errorMessage,
    clearError,
    setShowQRModal,
    selectTeamInLobby,
    toggleReadyInLobby,
    populate15DemoPlayers,
    runTeacherCommand,
    syncRoomFromServer,
    closeRoom,
  } = useGameStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState<string>('');
  const [startingGame, setStartingGame] = useState<boolean>(false);

  // Automatic WebSocket reconnect + HTTP state resync safety while waiting in Lobby
  useEffect(() => {
    if (!isRemoteSession || !roomState) return;

    const resyncNow = () => {
      mpClient.forceReconnectIfNeeded();
      void syncRoomFromServer();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        resyncNow();
      }
    };

    window.addEventListener('focus', resyncNow);
    window.addEventListener('online', resyncNow);
    document.addEventListener('visibilitychange', handleVisibility);

    const intervalMs = connectionStatus === 'connected' ? 12000 : 2500;
    const pollTimer = setInterval(() => {
      void syncRoomFromServer();
    }, intervalMs);

    return () => {
      window.removeEventListener('focus', resyncNow);
      window.removeEventListener('online', resyncNow);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(pollTimer);
    };
  }, [isRemoteSession, roomState?.roomCode, connectionStatus, syncRoomFromServer]);

  if (!roomState) return null;

  const activeParticipants = roomState.players.filter(isPlayerCountedAsParticipant);
  const participantStats = getRoomParticipantStats(roomState);
  const myPlayer = roomState.players.find((p) => p.id === playerId);
  const connectionLabel =
    connectionStatus === 'connected'
      ? 'Servidor Cloudflare Sincronizado'
      : connectionStatus === 'connecting'
      ? 'Conectando con Cloudflare Workers...'
      : isRemoteSession
      ? 'Reconectando con la sala en Cloudflare...'
      : 'Sincronización Multi-Pestaña Activa';

  return (
    <main className="screen-page lobby-page">
      <div className="page-container">
        {/* Cabecera de Sala de Espera */}
        <div className="lobby-top-banner">
          <div className="lobby-title-col">
            <span className="lobby-tag">SALA DE ESPERA MULTIJUGADOR 3D</span>
            <h1>{roomState.config.roomName}</h1>
            <div className="lobby-meta-pills">
              <span className="meta-pill">
                <Users size={15} /> Conectados: {participantStats.connectedCount} /{' '}
                {participantStats.maxPlayers}
                {participantStats.disconnectedCount > 0
                  ? ` (${participantStats.registeredCount} reg., ${participantStats.disconnectedCount} desc.)`
                  : ''}
              </span>
              <span className="meta-pill">
                {participantStats.teacherConnected
                  ? 'Docente conectado'
                  : 'Docente reconectando'}
              </span>
              <span className="meta-pill">
                <Wifi size={15} /> {connectionLabel}
              </span>
              <span className="meta-pill">
                Dados: <strong>{roomState.config.diceMode.toUpperCase()}</strong>
              </span>
              <span className="meta-pill">
                Fallo en pregunta:{' '}
                <strong>
                  {roomState.config.wrongAnswerPenalty === 0
                    ? 'Sin retroceso'
                    : `Retrocede ${roomState.config.wrongAnswerPenalty} ${
                        roomState.config.wrongAnswerPenalty === 1 ? 'casilla' : 'casillas'
                      }`}
                </strong>
              </span>
            </div>
          </div>

          <div className="lobby-access-col">
            <div className="lobby-code-card" onClick={() => setShowQRModal(true)}>
              <span>CÓDIGO DE ACCESO</span>
              <strong>{roomState.roomCode}</strong>
              <small>
                <QrCode size={13} /> Pulsa para mostrar QR y Enlace
              </small>
            </div>
          </div>
        </div>

        {/* Escaparate 3D de las Fichas de Equipos */}
        <LobbyScene3D teams={roomState.teams} />

        {errorMessage && (
          <div className="error-banner" role="alert">
            <span>{errorMessage}</span>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={clearError}
              style={{ marginLeft: '0.75rem' }}
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Acciones Rápidas de Docente y Jugador */}
        <div className="lobby-toolbar">
          <div className="lobby-toolbar-left">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowQRModal(true)}
            >
              <QrCode size={17} /> Compartir Código QR / Enlace
            </button>

            {myPlayer && !myPlayer.isTeacher && !myPlayer.isSpectator && (
              <button
                type="button"
                className={`btn-secondary ${myPlayer.ready ? 'btn-ready-on' : ''}`}
                onClick={toggleReadyInLobby}
              >
                <CheckCircle2 size={17} />
                <span>{myPlayer.ready ? '¡Estoy Listo/a!' : 'Marcar como Listo'}</span>
              </button>
            )}

            {isTeacher && activeParticipants.length < roomState.config.maxPlayers && (
              <button
                type="button"
                className="btn-secondary"
                onClick={populate15DemoPlayers}
                title="Completa automáticamente los 3 equipos de 5 personas (15 participantes) para probar roles y turnos"
              >
                <UserPlus size={17} /> Completar con {roomState.config.maxPlayers} Participantes (3×5)
              </button>
            )}
          </div>

          <div className="lobby-toolbar-right">
            {isTeacher ? (
              <>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => void closeRoom()}
                >
                  Cerrar Sala
                </button>
                <button
                  type="button"
                  className="btn-primary btn-lg"
                  disabled={startingGame}
                  onClick={() => {
                    setStartingGame(true);
                    void Promise.resolve(runTeacherCommand({ kind: 'START_GAME' })).finally(() => {
                      setStartingGame(false);
                    });
                  }}
                >
                  <Play size={20} />{' '}
                  {startingGame ? 'INICIANDO PARTIDA...' : 'INICIAR PARTIDA EN TABLERO 3D'}
                </button>
              </>
            ) : (
              <div className="waiting-teacher-pill">
                <Sparkles size={16} className="text-yellow" />
                <span>Esperando a que el profesor pulse INICIAR PARTIDA...</span>
              </div>
            )}
          </div>
        </div>

        {/* Columnas de Equipos y Roles Rotativos */}
        <div className="lobby-teams-grid">
          {roomState.teams.map((team) => {
            const members = activeParticipants.filter((p) => p.teamId === team.id);
            const isMyTeam = myPlayer?.teamId === team.id;

            return (
              <div
                key={team.id}
                className={`lobby-team-card ${isMyTeam ? 'my-team-highlight' : ''}`}
                style={{ borderTop: `4px solid ${team.hexColor}` }}
              >
                <div className="lobby-team-head">
                  <div>
                    <h3 style={{ color: team.hexColor }}>{team.name}</h3>
                    <span className="team-count-badge">
                      {members.length} integrantes conectados
                    </span>
                  </div>

                  {!isTeacher && !myPlayer?.isSpectator && !isMyTeam && (
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => selectTeamInLobby(team.id)}
                    >
                      Unirme a este equipo
                    </button>
                  )}
                </div>

                <div className="lobby-members-list">
                  {members.length === 0 ? (
                    <p className="empty-team-msg">
                      Sin participantes asignados todavía. Únete con el código {roomState.roomCode}.
                    </p>
                  ) : (
                    members.map((m) => {
                      const roleEntry = team.currentRoles.find((r) => r.playerId === m.id);
                      return (
                        <div key={m.id} className="lobby-member-row">
                          <div className="member-main-info">
                            <span
                              className={`conn-indicator ${m.connected ? 'on' : 'off'}`}
                              title={m.connected ? 'Conectado' : 'Desconectado'}
                            />
                            {renamingId === m.id ? (
                              <div className="rename-inline">
                                <input
                                  type="text"
                                  value={renameText}
                                  onChange={(e) => setRenameText(e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="btn-ghost-sm"
                                  onClick={() => {
                                    runTeacherCommand({
                                      kind: 'RENAME_PLAYER',
                                      playerId: m.id,
                                      newName: renameText,
                                    });
                                    setRenamingId(null);
                                  }}
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <strong>
                                {m.name} {m.id === playerId ? '(Tú)' : ''}
                              </strong>
                            )}
                            <span className={`ready-tag ${m.ready ? 'yes' : 'no'}`}>
                              {m.ready ? 'Listo' : 'Pendiente'}
                            </span>
                          </div>

                          {/* Roles asignados en el Turno 1 */}
                          {roleEntry && roleEntry.roles.length > 0 && (
                            <div className="member-roles-row">
                              {roleEntry.roles.map((r) => (
                                <span key={r} className="mini-role-badge">
                                  {TEAM_ROLE_INFO[r].title}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Controles del Profesor sobre el participante */}
                          {isTeacher && (
                            <div className="member-teacher-controls">
                              <select
                                value={m.teamId}
                                onChange={(e) =>
                                  runTeacherCommand({
                                    kind: 'ASSIGN_TEAM',
                                    playerId: m.id,
                                    teamId: e.target.value,
                                  })
                                }
                                aria-label={`Mover a ${m.name} de equipo`}
                              >
                                {roomState.teams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    → {t.name.split('(')[0].trim()}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn-icon-only"
                                title="Cambiar nombre"
                                onClick={() => {
                                  setRenamingId(m.id);
                                  setRenameText(m.name);
                                }}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon-only danger"
                                title="Eliminar participante"
                                onClick={() =>
                                  runTeacherCommand({
                                    kind: 'KICK_PLAYER',
                                    playerId: m.id,
                                  })
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
};
