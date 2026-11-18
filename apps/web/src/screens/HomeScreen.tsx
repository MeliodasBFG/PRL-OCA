import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Database,
  HelpCircle,
  Lock,
  Play,
  PlusCircle,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';
import { HomeScene3D } from '../scenes/HomeScene3D';
import { soundEngine } from '../audio/SoundEngine';

export const HomeScreen: React.FC = () => {
  const {
    reducedMotion,
    setScreen,
    setCreateJoinTab,
    setShowSettingsModal,
    setShowInstructionsModal,
    startIndividualGame,
  } = useGameStore();

  const [showSoloPrompt, setShowSoloPrompt] = useState(false);
  const [soloName, setSoloName] = useState('Especialista PRL');
  const [showTeacherUnlock, setShowTeacherUnlock] = useState(false);
  const [pinInput, setPinInput] = useState('PRL2026');

  const handleFirstAudioInteraction = () => {
    soundEngine.unlockAudio();
    soundEngine.playMusic('menu');
  };

  return (
    <main className="home-screen" onClick={handleFirstAudioInteraction}>
      {/* Escena 3D Industrial Animada de Fondo */}
      <HomeScene3D reducedMotion={reducedMotion} />

      <div className="home-overlay-content">
        {/* Emblema y Logotipo Original PRL-OCA 3D */}
        <div className="hero-badge-pill">
          <ShieldCheck size={16} />
          <span>SIMULADOR MULTIJUGADOR 3D DE SEGURIDAD Y SALUD LABORAL · HASTA 15 JUGADORES</span>
        </div>

        <h1 className="hero-main-title">
          PRL-OCA <span className="text-yellow">3D ONLINE</span>
        </h1>
        <p className="hero-subtitle">
          Recorre un complejo industrial tridimensional de <strong>48 casillas</strong>, supera{' '}
          <strong>8 desafíos 3D interactivos</strong>, resuelve casos reales de prevención y lleva
          a tu equipo hasta la <strong>Meta Cero Accidentes</strong>.
        </p>

        {/* Botonera Principal solicitada en Especificación (Sección 18) */}
        <div className="hero-buttons-grid">
          <button
            type="button"
            className="btn-hero-primary"
            onClick={() => {
              setCreateJoinTab('create');
              setScreen('create_join');
            }}
          >
            <Play size={22} />
            <div>
              <strong>JUGAR</strong>
              <span>Partida por Equipos o Individual</span>
            </div>
          </button>

          <button
            type="button"
            className="btn-hero-accent"
            onClick={() => {
              setCreateJoinTab('create');
              setScreen('create_join');
            }}
          >
            <PlusCircle size={22} />
            <div>
              <strong>CREAR NUEVA PARTIDA</strong>
              <span>3 Equipos de 5 (15 jugadores) + QR</span>
            </div>
          </button>

          <button
            type="button"
            className="btn-hero-secondary"
            onClick={() => {
              setCreateJoinTab('join');
              setScreen('create_join');
            }}
          >
            <Users size={22} />
            <div>
              <strong>UNIRSE A PARTIDA</strong>
              <span>Entrar con Código o Enlace</span>
            </div>
          </button>

          <button
            type="button"
            className="btn-hero-secondary"
            onClick={() => setShowSoloPrompt(true)}
          >
            <User size={22} />
            <div>
              <strong>MODO INDIVIDUAL</strong>
              <span>Entrenamiento Autónomo 3D</span>
            </div>
          </button>

          <button
            type="button"
            className="btn-hero-ghost"
            onClick={() => setShowInstructionsModal(true)}
          >
            <HelpCircle size={20} />
            <span>INSTRUCCIONES</span>
          </button>

          <button
            type="button"
            className="btn-hero-ghost"
            onClick={() => setShowSettingsModal(true)}
          >
            <Settings size={20} />
            <span>CONFIGURACIÓN</span>
          </button>
        </div>

        {/* Acceso Protegido de Profesor: Editor de Banco de Preguntas e Historial */}
        <div className="teacher-home-strip">
          <div className="teacher-strip-head">
            <Lock size={15} className="text-yellow" />
            <span>Herramientas del Docente / Administrador (Acceso Protegido):</span>
          </div>
          {!showTeacherUnlock ? (
            <div className="teacher-strip-btns">
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setShowTeacherUnlock(true)}
              >
                <Database size={15} /> Gestionar Banco de Preguntas PRL
              </button>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setScreen('history')}
              >
                <BarChart3 size={15} /> Historial y Estadísticas de Partidas
              </button>
            </div>
          ) : (
            <div className="teacher-unlock-inline">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Clave docente (ej. PRL2026)"
                aria-label="Clave de acceso docente"
              />
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (pinInput.trim().length >= 4) {
                    setScreen('question_editor');
                  }
                }}
              >
                <BookOpen size={15} /> Abrir Editor de Contenidos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal rápido para iniciar Modo Individual */}
      {showSoloPrompt && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card sm-modal-card">
            <h3>Iniciar Modo Individual 3D</h3>
            <p>
              Recorrerás las 48 casillas compitiendo contra la Brigada Preventiva IA con acceso a
              todos los desafíos 3D y explicaciones normativas.
            </p>
            <label className="full-width-label">
              Tu Nombre o Alias:
              <input
                type="text"
                value={soloName}
                onChange={(e) => setSoloName(e.target.value)}
              />
            </label>
            <div className="modal-btn-row">
              <button
                type="button"
                className="btn-primary"
                onClick={() => startIndividualGame(soloName)}
              >
                Comenzar Partida 3D
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSoloPrompt(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
