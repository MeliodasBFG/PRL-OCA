import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, KeyRound, PlusCircle, Shield, Users } from 'lucide-react';
import { Difficulty, WrongAnswerPenalty } from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { enterGameLandscapeMode } from '../utils/mobileOrientation';

export const CreateJoinScreen: React.FC = () => {
  const {
    createJoinTab,
    errorMessage,
    setCreateJoinTab,
    setScreen,
    createRoom,
    joinRoom,
  } = useGameStore();

  // Create Room Form State (Default: 15 participants in 3 teams of 5)
  const [roomName, setRoomName] = useState('Formación PRL · Grupo Principal');
  const [teacherName, setTeacherName] = useState('Docente PRL');
  const [teacherPin, setTeacherPin] = useState('PRL2026');
  const [mode, setMode] = useState<'teams' | 'individual'>('teams');
  const [teamCount, setTeamCount] = useState<number>(3);
  const [maxPlayers, setMaxPlayers] = useState<number>(15);
  const [diceMode, setDiceMode] = useState<'1d6' | '2d6'>('1d6');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'todas'>('todas');
  const [wrongAnswerPenalty, setWrongAnswerPenalty] = useState<WrongAnswerPenalty>(0);

  // Join Room Form State
  const [joinCode, setJoinCode] = useState('PRL101');
  const [joinAlias, setJoinAlias] = useState(() => {
    if (typeof window === 'undefined') return 'Alumno/a PRL';
    return window.sessionStorage.getItem('prl_oca_player_name') || 'Alumno/a PRL';
  });
  const [joinRole, setJoinRole] = useState<'player' | 'spectator' | 'teacher'>('player');
  const [joinTeacherPin, setJoinTeacherPin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom) {
        setJoinCode(urlRoom.toUpperCase());
        setCreateJoinTab('join');
      }
    }
  }, [setCreateJoinTab]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void enterGameLandscapeMode();
    await createRoom({
      teacherName,
      teacherPin,
      config: {
        roomName,
        mode,
        teamCount,
        maxPlayers,
        diceMode,
        difficultyFilter,
        wrongAnswerPenalty,
      },
    });
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    void enterGameLandscapeMode();
    await joinRoom({
      roomCode: joinCode,
      playerName: joinAlias,
      isTeacher: joinRole === 'teacher',
      isSpectator: joinRole === 'spectator',
      teacherPin: joinRole === 'teacher' ? joinTeacherPin : undefined,
    });
  };

  return (
    <main className="screen-page create-join-page">
      <div className="page-container narrow-container">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setScreen('home')}
        >
          <ArrowLeft size={16} /> Volver al Inicio
        </button>

        <div className="tabs-header">
          <button
            type="button"
            className={`tab-btn ${createJoinTab === 'create' ? 'active' : ''}`}
            onClick={() => setCreateJoinTab('create')}
          >
            <PlusCircle size={18} /> CREAR NUEVA PARTIDA (Docente)
          </button>
          <button
            type="button"
            className={`tab-btn ${createJoinTab === 'join' ? 'active' : ''}`}
            onClick={() => setCreateJoinTab('join')}
          >
            <Users size={18} /> UNIRSE A UNA SALA (Participante)
          </button>
        </div>

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        {createJoinTab === 'create' ? (
          <form className="config-card" onSubmit={(e) => void handleCreateSubmit(e)}>
            <h2>Configurar Nueva Partida Multijugador Online</h2>
            <p className="card-desc">
              Predeterminado para formación: <strong>15 participantes en 3 equipos de 5 personas</strong>{' '}
              (Equipo Azul, Equipo Naranja y Equipo Verde). Puedes ajustarlo libremente.
            </p>

            <div className="form-grid-2">
              <label>
                Nombre de la Partida / Curso:
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </label>

              <label>
                Nombre del Profesor / Formador:
                <input
                  type="text"
                  required
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                />
              </label>

              <label>
                Modalidad de Juego:
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'teams' | 'individual')}
                >
                  <option value="teams">Multijugador por Equipos (Roles rotativos)</option>
                  <option value="individual">Individual (Cada jugador con su ficha)</option>
                </select>
              </label>

              {mode === 'teams' && (
                <label>
                  Número de Equipos (2 a 5):
                  <select
                    value={teamCount}
                    onChange={(e) => setTeamCount(Number(e.target.value))}
                  >
                    <option value={2}>2 Equipos (Azul y Naranja)</option>
                    <option value={3}>3 Equipos (Azul, Naranja y Verde - Predeterminado)</option>
                    <option value={4}>4 Equipos (Azul, Naranja, Verde y Morado)</option>
                    <option value={5}>5 Equipos (Azul, Naranja, Verde, Morado y Rojo)</option>
                  </select>
                </label>
              )}

              <label>
                Máximo de Participantes (2 a 15):
                <input
                  type="number"
                  min={2}
                  max={15}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Math.max(2, Math.min(15, Number(e.target.value))))}
                />
              </label>

              <label>
                Modalidad de Dados 3D:
                <select
                  value={diceMode}
                  onChange={(e) => setDiceMode(e.target.value as '1d6' | '2d6')}
                >
                  <option value="1d6">1 Dado de 6 caras (1D6 - Recorrido táctico)</option>
                  <option value="2d6">2 Dados de 6 caras (2D6 - Partida rápida)</option>
                </select>
              </label>

              <label>
                Nivel de Dificultad de Preguntas:
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | 'todas')}
                >
                  <option value="todas">Progresiva (Fácil, Intermedio y Avanzado)</option>
                  <option value="facil">Nivel Básico / Fácil (30s)</option>
                  <option value="intermedio">Nivel Intermedio (45s)</option>
                  <option value="avanzado">Nivel Técnico Avanzado (60s)</option>
                </select>
              </label>

              <label>
                Si se falla una pregunta:
                <select
                  value={wrongAnswerPenalty}
                  onChange={(e) =>
                    setWrongAnswerPenalty(Number(e.target.value) as WrongAnswerPenalty)
                  }
                >
                  <option value={0}>No pasa nada (se mantiene en su casilla)</option>
                  <option value={1}>Retrocede 1 casilla</option>
                  <option value={2}>Retrocede 2 casillas</option>
                </select>
              </label>

              <label>
                Clave / PIN de Control del Profesor:
                <input
                  type="text"
                  required
                  minLength={4}
                  value={teacherPin}
                  onChange={(e) => setTeacherPin(e.target.value)}
                />
              </label>
            </div>

            <div className="preset-banner">
              <Shield size={18} className="text-yellow" />
              <span>
                Al pulsar <strong>CREAR SALA</strong> se generará el código aleatorio, enlace
                compartible, código QR y la sala de espera 3D.
              </span>
            </div>

            <button type="submit" className="btn-primary btn-lg full-btn">
              CREAR NUEVA PARTIDA Y ABRIR SALA DE ESPERA 3D
            </button>
          </form>
        ) : (
          <form className="config-card" onSubmit={(e) => void handleJoinSubmit(e)}>
            <h2>Acceso a Partida Online sin Instalaciones</h2>
            <p className="card-desc">
              Introduce el código proyectado por el formador y tu nombre o alias para incorporarte
              al equipo.
            </p>

            <div className="form-grid-2">
              <label>
                Código de Sala (ej. PRL101):
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em' }}
                />
              </label>

              <label>
                Tu Nombre o Alias (sin registro personal):
                <input
                  type="text"
                  required
                  maxLength={36}
                  value={joinAlias}
                  onChange={(e) => setJoinAlias(e.target.value)}
                />
              </label>

              <label>
                Tipo de Acceso:
                <select
                  value={joinRole}
                  onChange={(e) =>
                    setJoinRole(e.target.value as 'player' | 'spectator' | 'teacher')
                  }
                >
                  <option value="player">Participante / Jugador de Equipo</option>
                  <option value="spectator">Modo Espectador / Proyección en Aula</option>
                  <option value="teacher">Docente / Administrador (Con Clave)</option>
                </select>
              </label>

              {joinRole === 'teacher' && (
                <label>
                  <KeyRound size={14} /> Clave del Docente:
                  <input
                    type="password"
                    required
                    value={joinTeacherPin}
                    onChange={(e) => setJoinTeacherPin(e.target.value)}
                    placeholder="PRL2026"
                  />
                </label>
              )}
            </div>

            {joinRole === 'spectator' && (
              <div className="preset-banner">
                <Eye size={18} />
                <span>
                  En Modo Espectador visualizarás el tablero 3D y las preguntas a pantalla completa
                  sin ocupar plaza en los equipos.
                </span>
              </div>
            )}

            <button type="submit" className="btn-primary btn-lg full-btn">
              ENTRAR A LA SALA DE JUEGO
            </button>
          </form>
        )}
      </div>
    </main>
  );
};
