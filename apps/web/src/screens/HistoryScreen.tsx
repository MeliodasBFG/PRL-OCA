import React from 'react';
import { ArrowLeft, BarChart3, Download, Trophy } from 'lucide-react';
import { PRL_CATEGORY_LABELS } from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';

export const HistoryScreen: React.FC = () => {
  const { matchHistory, setScreen } = useGameStore();

  const exportAllHistoryCSV = () => {
    const headers = [
      'Fecha',
      'Codigo_Sala',
      'Nombre_Partida',
      'Modalidad',
      'Equipo_Ganador',
      'Puntos_Ganador',
      'Turnos',
      'Preguntas_Respondidas',
      'Precision_Porcentaje',
    ];
    const rows = matchHistory.map((m) => [
      new Date(m.finishedAt).toISOString(),
      m.roomCode,
      `"${m.roomName}"`,
      m.mode,
      `"${m.winnerTeamName}"`,
      m.winnerScore,
      m.totalTurns,
      m.totalQuestions,
      m.overallAccuracy,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-partidas-prl-oca.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="screen-page history-page">
      <div className="page-container">
        <div className="editor-topbar">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setScreen('home')}
          >
            <ArrowLeft size={16} /> Volver al Menú Principal
          </button>

          <div>
            <h1>
              <BarChart3 size={24} className="text-yellow" /> Historial de Partidas y Evolución del
              Grupo
            </h1>
            <p>
              Registro histórico de sesiones formativas completadas, precisión grupal y áreas de
              mejora.
            </p>
          </div>

          {matchHistory.length > 0 && (
            <button type="button" className="btn-primary" onClick={exportAllHistoryCSV}>
              <Download size={16} /> Exportar Historial CSV
            </button>
          )}
        </div>

        {matchHistory.length === 0 ? (
          <div className="config-card">
            <h3>Todavía no hay partidas finalizadas en este dispositivo</h3>
            <p>
              Cuando completes una partida en modo por equipos o individual (o la finalices desde
              el Panel Docente), sus resultados, porcentajes de acierto e insignias aparecerán
              automáticamente aquí.
            </p>
          </div>
        ) : (
          <div className="history-cards-list">
            {matchHistory.map((m) => (
              <div key={m.id} className="history-record-card">
                <div className="history-record-head">
                  <div>
                    <span className="q-chip-tile" style={{ background: m.winnerColor }}>
                      Sala {m.roomCode}
                    </span>
                    <h3>{m.roomName}</h3>
                    <small>{new Date(m.finishedAt).toLocaleString('es-ES')}</small>
                  </div>
                  <div className="history-winner-box">
                    <Trophy size={18} className="text-yellow" />
                    <strong>
                      Ganador: {m.winnerTeamName} ({m.winnerScore} pts)
                    </strong>
                    <span>
                      Precisión grupal: {m.overallAccuracy}% en {m.totalQuestions} retos
                    </span>
                  </div>
                </div>

                {m.masteredCategories.length > 0 && (
                  <p className="history-cat-line">
                    <strong>Dominadas:</strong>{' '}
                    {m.masteredCategories.map((c) => PRL_CATEGORY_LABELS[c]).join(', ')}
                  </p>
                )}
                {m.reinforceCategories.length > 0 && (
                  <p className="history-cat-line">
                    <strong>Para refuerzo:</strong>{' '}
                    {m.reinforceCategories.map((c) => PRL_CATEGORY_LABELS[c]).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
