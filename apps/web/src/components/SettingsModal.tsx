import React, { useState } from 'react';
import { Accessibility, Monitor, Volume2, X } from 'lucide-react';
import { GraphicsQuality } from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { soundEngine } from '../audio/SoundEngine';

export const SettingsModal: React.FC = () => {
  const {
    showSettingsModal,
    graphicsQuality,
    board2DMode,
    highContrast,
    reducedMotion,
    setShowSettingsModal,
    setGraphicsQuality,
    setBoard2DMode,
    setHighContrast,
    setReducedMotion,
  } = useGameStore();

  const [audioState, setAudioState] = useState({ ...soundEngine.settings });

  if (!showSettingsModal) return null;

  const updateAudio = (partial: Partial<typeof audioState>) => {
    const next = soundEngine.updateSettings(partial);
    setAudioState({ ...next });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="set-title">
      <div className="modal-card settings-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <Monitor size={22} className="text-yellow" />
            <h2 id="set-title">Configuración de Audio, Gráficos 3D y Accesibilidad</h2>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setShowSettingsModal(false)}
            aria-label="Cerrar configuración"
          >
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          {/* Audio */}
          <section className="settings-section">
            <h3>
              <Volume2 size={18} /> Control de Audio y Música Ambiental
            </h3>
            <div className="settings-toggles">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={!audioState.masterMuted}
                  onChange={(e) => updateAudio({ masterMuted: !e.target.checked })}
                />
                <span>Sonido General Activado</span>
              </label>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={audioState.musicEnabled}
                  onChange={(e) => updateAudio({ musicEnabled: e.target.checked })}
                />
                <span>Música Ambiental del Videojuego</span>
              </label>

              <label className="slider-row">
                <span>Volumen de Música ({Math.round(audioState.musicVolume * 100)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioState.musicVolume}
                  onChange={(e) => updateAudio({ musicVolume: Number(e.target.value) })}
                />
              </label>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={audioState.sfxEnabled}
                  onChange={(e) => updateAudio({ sfxEnabled: e.target.checked })}
                />
                <span>Efectos de Sonido (Dados, Fichas, Alertas, Recompensas)</span>
              </label>

              <label className="slider-row">
                <span>Volumen de Efectos ({Math.round(audioState.sfxVolume * 100)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioState.sfxVolume}
                  onChange={(e) => {
                    updateAudio({ sfxVolume: Number(e.target.value) });
                    soundEngine.playSfx('button_click');
                  }}
                />
              </label>
            </div>
          </section>

          {/* Rendimiento Gráfico 3D */}
          <section className="settings-section">
            <h3>
              <Monitor size={18} /> Calidad Gráfica 3D y Optimización Móvil
            </h3>
            <div className="quality-buttons-row">
              {(['baja', 'media', 'alta', 'ultra'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setGraphicsQuality(q)}
                  className={`quality-btn ${graphicsQuality === q ? 'active' : ''}`}
                >
                  <strong>{q.toUpperCase()}</strong>
                  <span>
                    {q === 'baja' && 'Móviles modestos (30+ FPS)'}
                    {q === 'media' && 'Equilibrado (Tablets/Portátiles)'}
                    {q === 'alta' && 'Sombras dinámicas + Partículas'}
                    {q === 'ultra' && 'Máximo detalle (60 FPS GPU)'}
                  </span>
                </button>
              ))}
            </div>

            <label className="toggle-row" style={{ marginTop: '12px' }}>
              <input
                type="checkbox"
                checked={board2DMode}
                onChange={(e) => setBoard2DMode(e.target.checked)}
              />
              <span>
                Activar Tablero Simplificado 2D (para dispositivos sin aceleración 3D o preferencia
                táctica)
              </span>
            </label>
          </section>

          {/* Accesibilidad */}
          <section className="settings-section">
            <h3>
              <Accessibility size={18} /> Accesibilidad Universal
            </h3>
            <div className="settings-toggles">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={audioState.visualCaptions}
                  onChange={(e) => updateAudio({ visualCaptions: e.target.checked })}
                />
                <span>Mostrar subtítulos y avisos visuales para efectos de sonido</span>
              </label>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                />
                <span>Reducir movimiento de cámara y animaciones intensas</span>
              </label>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                />
                <span>Modo de Alto Contraste Industrial</span>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
