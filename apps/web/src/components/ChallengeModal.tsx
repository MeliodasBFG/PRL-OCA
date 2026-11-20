import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Scale,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { canPlayerActOnTeamTurn } from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';
import { ChallengeScene3D } from '../scenes/ChallengeScene3D';
import { soundEngine } from '../audio/SoundEngine';

export const ChallengeModal: React.FC = () => {
  const {
    roomState,
    playerId,
    isRollingAnimation,
    isTokenMoving,
    challengeModalReady,
    completeChallenge3D,
    nextTurn,
  } = useGameStore();
  const activeChallenge = roomState?.activeChallenge;
  const challenge =
    activeChallenge?.kind === 'challenge3d' ? activeChallenge.challenge3d : undefined;
  const activeTeam = roomState?.teams[roomState.activeTeamIndex ?? 0];
  const isMyTurn = roomState ? canPlayerActOnTeamTurn(roomState, playerId).allowed : false;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number>(90);

  const isModalVisible = Boolean(
    roomState &&
      activeChallenge &&
      activeChallenge.kind === 'challenge3d' &&
      challenge &&
      challengeModalReady &&
      !isRollingAnimation &&
      !isTokenMoving
  );

  useEffect(() => {
    if (!challenge || !activeChallenge || !isModalVisible) return;
    setSelectedIds([]);
    setSecondsLeft(challenge.timeSeconds);
  }, [challenge?.id, activeChallenge?.startedAt, isModalVisible]);

  useEffect(() => {
    if (
      !isModalVisible ||
      !challenge ||
      !activeChallenge ||
      activeChallenge.answered ||
      roomState?.status === 'paused'
    ) {
      return;
    }
    const timer = setInterval(() => {
      const rem = Math.max(0, Math.ceil((activeChallenge.expiresAt - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem === 0) {
        soundEngine.playSfx('time_up');
        clearInterval(timer);
        if (isMyTurn) {
          completeChallenge3D(selectedIds.length > 0 ? selectedIds : ['timeout']);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [
    isModalVisible,
    challenge?.id,
    activeChallenge?.answered,
    activeChallenge?.expiresAt,
    roomState?.status,
    isMyTurn,
    selectedIds,
    completeChallenge3D,
  ]);

  if (!isModalVisible || !roomState || !activeChallenge || !challenge) {
    return null;
  }

  const isAnswered = activeChallenge.answered;
  const isCorrect = Boolean(activeChallenge.isCorrect);

  const toggleHotspot = (id: string) => {
    if (isAnswered || !isMyTurn) return;
    soundEngine.playSfx('button_click');
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="modal-backdrop question-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card challenge-modal-card modal-animate-in">
        <div className="q-header-strip">
          <div className="q-badges-row">
            <span className="q-chip-tile" style={{ background: '#7C3AED' }}>
              DESAFÍO 3D INTERACTIVO #{challenge.number}
            </span>
            <span className="q-chip-diff diff-avanzado">{challenge.points} PUNTOS</span>
          </div>
          <div className="q-timer-pill">
            <Clock size={18} />
            <span>{isAnswered ? 'Completado' : `${secondsLeft}s`}</span>
          </div>
        </div>

        <div className="challenge-modal-grid">
          <div className="challenge-left-col">
            <ChallengeScene3D
              challenge={challenge}
              selectedIds={selectedIds}
              revealed={isAnswered}
              onToggleHotspot={toggleHotspot}
            />
            <p className="challenge-viewport-caption">
              Rota la cámara 3D y pulsa sobre los marcadores numerados (1–5) o selecciónalos en la
              lista adjunta.
            </p>
          </div>

          <div className="challenge-right-col">
            <h2>{challenge.title}</h2>
            <p className="challenge-instructions">{challenge.instructions}</p>

            <div className="challenge-counter-bar">
              <span>
                Elementos seleccionados: <strong>{selectedIds.length}</strong> /{' '}
                {challenge.requiredSelections} requeridos
              </span>
            </div>

            <div className="challenge-hotspots-list">
              {challenge.hotspots.map((h, idx) => {
                const isSel = selectedIds.includes(h.id);
                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHotspot(h.id)}
                    className={`challenge-hotspot-row ${isSel ? 'selected' : ''} ${
                      isAnswered ? (h.isCorrect ? 'row-correct' : 'row-wrong') : ''
                    }`}
                  >
                    <div className="hotspot-row-head">
                      <span className="hotspot-idx">{idx + 1}</span>
                      <strong>{h.label}</strong>
                    </div>
                    <p className="hotspot-desc">{h.description}</p>
                    {isAnswered && <p className="hotspot-feedback">{h.feedback}</p>}
                  </div>
                );
              })}
            </div>

            {isAnswered && (
              <div className={`pedagogical-box ${isCorrect ? 'ped-correct' : 'ped-wrong'}`}>
                <div className="ped-header">
                  {isCorrect ? (
                    <CheckCircle2 size={22} className="text-green" />
                  ) : (
                    <AlertOctagon size={22} className="text-orange" />
                  )}
                  <h3>
                    {isCorrect
                      ? `¡Desafío 3D Superado! (+${activeChallenge.pointsAwarded} pts)`
                      : `Revisión Técnica del Escenario (+${activeChallenge.pointsAwarded ?? 0} pts)`}
                  </h3>
                </div>
                <p>{challenge.pedagogicalSummary}</p>
                <p className="legal-ref-line">
                  <Scale size={14} /> <strong>Normativa:</strong> {challenge.legalReference}
                </p>
              </div>
            )}

            <div className="q-footer-bar">
              {!isMyTurn ? (
                <button type="button" className="btn-secondary btn-lg" disabled>
                  Modo observación · Inspecciona {activeTeam?.name.split('(')[0].trim()}
                </button>
              ) : !isAnswered ? (
                <button
                  type="button"
                  className="btn-primary btn-lg"
                  disabled={selectedIds.length === 0}
                  onClick={() => completeChallenge3D(selectedIds)}
                >
                  <Sparkles size={18} />
                  <span>Validar Inspección 3D ({selectedIds.length} marcados)</span>
                </button>
              ) : (
                <button type="button" className="btn-primary btn-lg" onClick={nextTurn}>
                  <ShieldAlert size={18} />
                  <span>Continuar Recorrido → Siguiente Turno</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
