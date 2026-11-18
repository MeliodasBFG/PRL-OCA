import React from 'react';
import {
  Camera,
  Eye,
  Home,
  QrCode,
  Settings,
  ShieldAlert,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CameraViewMode } from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { soundEngine } from '../audio/SoundEngine';

const CAMERA_LABELS: Record<CameraViewMode, string> = {
  isometric: '1. Isométrica General',
  path_close: '2. Vista Recorrido',
  active_tile: '3. Casilla Activa',
  dice: '4. Vista Dados 3D',
  teams: '5. Vista Equipos',
  goal: '6. Vista Meta (#48)',
};

export const HeaderBar: React.FC = () => {
  const {
    screen,
    roomState,
    connectionStatus,
    cameraView,
    board2DMode,
    isTeacher,
    projectorMode,
    captionToast,
    setCameraView,
    setBoard2DMode,
    setProjectorMode,
    setShowQRModal,
    setShowTeacherPanel,
    setShowSettingsModal,
    setShowInstructionsModal,
    leaveRoom,
  } = useGameStore();

  const [muted, setMuted] = React.useState(soundEngine.settings.masterMuted);

  const toggleMute = () => {
    const updated = soundEngine.updateSettings({ masterMuted: !muted });
    setMuted(updated.masterMuted);
  };

  return (
    <header className="top-header-bar" role="banner">
      <div className="header-brand" onClick={() => (roomState ? null : leaveRoom())}>
        <div className="logo-shield" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="36" height="36">
            <path
              d="M24 4L42 12V25C42 36 34 42 24 45C14 42 6 36 6 25V12L24 4Z"
              fill="#1E293B"
              stroke="#FFB800"
              strokeWidth="3"
            />
            <path d="M13 25C13 18 18 13 24 13C30 13 35 18 35 25H13Z" fill="#FFB800" />
            <rect x="11" y="24" width="26" height="4" rx="2" fill="#EA580C" />
            <circle cx="24" cy="34" r="5" fill="#10B981" />
          </svg>
        </div>
        <div>
          <span className="brand-title">PRL-OCA 3D</span>
          <span className="brand-badge">ONLINE</span>
        </div>
      </div>

      {/* Controles centrales en sala de espera o partida */}
      {roomState && (
        <div className="header-room-controls">
          <button
            type="button"
            className="room-code-pill"
            onClick={() => setShowQRModal(true)}
            title="Mostrar código QR y enlace para compartir"
          >
            <QrCode size={16} />
            <span>SALA: {roomState.roomCode}</span>
            <span
              className={`conn-dot ${
                connectionStatus === 'connected' ? 'online' : 'local'
              }`}
            />
          </button>

          {screen === 'game' && (
            <>
              <div className="camera-select-group">
                <Camera size={15} />
                <select
                  aria-label="Seleccionar vista de cámara 3D"
                  value={cameraView}
                  onChange={(e) => setCameraView(e.target.value as CameraViewMode)}
                  disabled={board2DMode}
                >
                  {(Object.keys(CAMERA_LABELS) as CameraViewMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {CAMERA_LABELS[mode]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => setCameraView('isometric')}
                  title="Recuperar perspectiva original"
                >
                  Reset Vista
                </button>
              </div>

              <button
                type="button"
                className={`btn-toggle-2d ${board2DMode ? 'active' : ''}`}
                onClick={() => setBoard2DMode(!board2DMode)}
                title="Alternar entre Tablero 3D y Tablero 2D simplificado"
              >
                {board2DMode ? 'Ver Tablero 3D' : 'Modo 2D Ligero'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Avisos visuales de sonido (Accesibilidad) */}
      {captionToast && (
        <div className="sound-caption-pill" role="status" aria-live="polite">
          {captionToast}
        </div>
      )}

      {/* Acciones de derecha */}
      <div className="header-actions">
        {roomState && isTeacher && !projectorMode && (
          <button
            type="button"
            className="btn-teacher"
            onClick={() => setShowTeacherPanel(true)}
          >
            <Sliders size={16} />
            <span>Panel Docente</span>
          </button>
        )}

        {roomState && (
          <button
            type="button"
            className={`btn-icon-label ${projectorMode ? 'active' : ''}`}
            onClick={() => setProjectorMode(!projectorMode)}
            title="Modo Proyección / Espectador (oculta controles privados del docente)"
          >
            <Eye size={16} />
            <span className="hide-mobile">
              {projectorMode ? 'Salir Proyección' : 'Modo Proyección'}
            </span>
          </button>
        )}

        <button
          type="button"
          className="btn-icon-only"
          onClick={() => setShowInstructionsModal(true)}
          aria-label="Instrucciones y Reglas PRL"
          title="Instrucciones y Reglas"
        >
          <ShieldAlert size={18} />
        </button>

        <button
          type="button"
          className="btn-icon-only"
          onClick={toggleMute}
          aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
          title={muted ? 'Activar sonido' : 'Silenciar todo'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button
          type="button"
          className="btn-icon-only"
          onClick={() => setShowSettingsModal(true)}
          aria-label="Configuración de audio, gráficos y accesibilidad"
          title="Configuración Audio / Gráficos / Accesibilidad"
        >
          <Settings size={18} />
        </button>

        {roomState && (
          <button
            type="button"
            className="btn-icon-only danger"
            onClick={leaveRoom}
            aria-label="Salir al menú principal"
            title="Salir al menú principal"
          >
            <Home size={18} />
          </button>
        )}
      </div>
    </header>
  );
};
