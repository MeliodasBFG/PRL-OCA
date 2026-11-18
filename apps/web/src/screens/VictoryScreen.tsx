import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import {
  Award,
  CheckCircle2,
  Download,
  Home,
  RotateCcw,
  ShieldAlert,
  Trophy,
} from 'lucide-react';
import {
  ALL_PRL_CATEGORIES,
  BADGE_DEFINITIONS,
  PRL_CATEGORY_LABELS,
  buildMatchHistoryFromState,
} from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { Mascot3D } from '../scenes/Mascot3D';
import { Badge3D } from '../characters/Badge3D';

export const VictoryScreen: React.FC = () => {
  const { roomState, leaveRoom, setScreen } = useGameStore();

  if (!roomState) return null;

  const summary = buildMatchHistoryFromState(roomState);
  const allUnlockedBadges = Array.from(
    new Set(roomState.teams.flatMap((t) => t.badges))
  );

  const exportResultsCSV = () => {
    const headers = [
      'Posicion_Final',
      'Equipo',
      'Puntuacion',
      'Casilla_Alcanzada',
      'Respuestas_Correctas',
      'Respuestas_Incorrectas',
      'Insignias_Desbloqueadas',
    ];
    const rows = summary.teamsSummary.map((t, i) => [
      i + 1,
      `"${t.name}"`,
      t.score,
      t.position,
      t.correctAnswers,
      t.wrongAnswers,
      `"${t.badges.join('; ')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultados-prl-oca-${roomState.roomCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="screen-page victory-page">
      {/* Lluvia de Confeti Preventivo */}
      <div className="confetti-layer" aria-hidden="true">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${(i * 3.7) % 100}%`,
              animationDelay: `${(i % 7) * 0.25}s`,
              backgroundColor: ['#FFB800', '#10B981', '#0284C7', '#EA580C'][i % 4],
            }}
          />
        ))}
      </div>

      <div className="page-container">
        <div className="victory-hero-card">
          <div className="victory-3d-stage">
            <Canvas camera={{ position: [0, 1.8, 5.2], fov: 42 }}>
              <color attach="background" args={['#0B1220']} />
              <ambientLight intensity={0.8} />
              <directionalLight position={[5, 8, 5]} intensity={1.4} />
              <Mascot3D position={[0, -0.8, 0]} scale={1.15} mood="celebrate" />
              {allUnlockedBadges.slice(0, 4).map((bId, idx) => (
                <Badge3D
                  key={bId}
                  badgeId={bId}
                  position={[-2.2 + idx * 1.45, 0.9, 0.5]}
                  scale={0.7}
                />
              ))}
              <Sparkles count={70} scale={[8, 4, 4]} size={2.5} speed={0.8} color="#FFB800" />
            </Canvas>
          </div>

          <div className="victory-hero-info">
            <div className="winner-crown-pill">
              <Trophy size={20} /> ¡META CERO ACCIDENTES ALCANZADA!
            </div>
            <h1 style={{ color: summary.winnerColor }}>{summary.winnerTeamName}</h1>
            <p className="victory-subtitle">
              Puntuación Final: <strong>{summary.winnerScore} puntos</strong> · Turnos jugados:{' '}
              <strong>{summary.totalTurns}</strong> · Precisión Global del Grupo:{' '}
              <strong>{summary.overallAccuracy}%</strong>
            </p>

            <div className="victory-cta-row">
              <button type="button" className="btn-primary" onClick={exportResultsCSV}>
                <Download size={17} /> Exportar Resultados en CSV
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setScreen('history')}
              >
                Ver Historial Completo
              </button>
              <button type="button" className="btn-secondary" onClick={leaveRoom}>
                <Home size={17} /> Volver al Menú Principal
              </button>
            </div>
          </div>
        </div>

        {/* Clasificación General de Equipos */}
        <section className="victory-section">
          <h2>Clasificación General y Logros por Equipo</h2>
          <div className="victory-podium-grid">
            {summary.teamsSummary.map((team, idx) => (
              <div
                key={team.name}
                className="podium-team-card"
                style={{ borderTop: `5px solid ${team.color}` }}
              >
                <div className="podium-rank-num">#{idx + 1}</div>
                <h3>{team.name}</h3>
                <div className="podium-score-big">{team.score} pts</div>
                <p>
                  Casilla alcanzada: <strong>#{team.position}/48</strong>
                </p>
                <p>
                  Aciertos: <strong>{team.correctAnswers}</strong> · Fallos:{' '}
                  <strong>{team.wrongAnswers}</strong>
                </p>

                <div className="podium-badges-wrap">
                  {team.badges.length === 0 ? (
                    <span className="no-badges-note">Sin insignias en esta sesión</span>
                  ) : (
                    team.badges.map((bId) => {
                      const def = BADGE_DEFINITIONS.find((b) => b.id === bId);
                      return (
                        <span
                          key={bId}
                          className="unlocked-badge-pill"
                          style={{ borderColor: def?.color }}
                        >
                          <Award size={14} /> {def?.name}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Diagnóstico Preventivo: Temáticas Dominadas vs. Recomendaciones de Repaso */}
        <section className="victory-section">
          <h2>Diagnóstico Formativo y Recomendaciones de Repaso</h2>
          <div className="diagnostics-grid">
            <div className="diag-card diag-good">
              <h3>
                <CheckCircle2 size={20} className="text-green" /> Categorías Mejor Resueltas
                (Dominadas ≥ 70%)
              </h3>
              {summary.masteredCategories.length === 0 ? (
                <p>Realiza más turnos para consolidar estadísticas por bloque temático.</p>
              ) : (
                <ul>
                  {summary.masteredCategories.map((c) => (
                    <li key={c}>{PRL_CATEGORY_LABELS[c]}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="diag-card diag-reinforce">
              <h3>
                <ShieldAlert size={20} className="text-orange" /> Áreas que Necesitan Refuerzo y
                Recomendación Pedagógica
              </h3>
              {summary.reinforceCategories.length === 0 ? (
                <p>
                  ¡Excelente! El grupo no ha registrado bloques con tasa de error elevada en esta
                  partida.
                </p>
              ) : (
                <ul>
                  {summary.reinforceCategories.map((c) => (
                    <li key={c}>
                      <strong>{PRL_CATEGORY_LABELS[c]}:</strong> Se recomienda repasar las Guías
                      Técnicas del INSST y realizar un taller práctico específico sobre este
                      bloque.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Desglose por las 16 categorías */}
          <div className="category-breakdown-table">
            <h3>Estadísticas Detalladas por Categoría PRL</h3>
            <div className="cat-stats-grid">
              {ALL_PRL_CATEGORIES.map((cat) => {
                const st = roomState.categoryStats[cat];
                const total = (st?.correct ?? 0) + (st?.wrong ?? 0);
                const avgSec =
                  total > 0 ? ((st.totalTimeMs / total) / 1000).toFixed(1) : '-';
                return (
                  <div key={cat} className="cat-stat-cell">
                    <strong>{PRL_CATEGORY_LABELS[cat]}</strong>
                    <span>
                      Aciertos: {st?.correct ?? 0} | Fallos: {st?.wrong ?? 0} | Tiempo medio:{' '}
                      {avgSec}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
