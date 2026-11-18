import React from 'react';
import { Award, Compass, ShieldCheck, Users, X } from 'lucide-react';
import { BADGE_DEFINITIONS, TEAM_ROLES_ORDER, TEAM_ROLE_INFO } from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';

export const InstructionsModal: React.FC = () => {
  const { showInstructionsModal, setShowInstructionsModal } = useGameStore();
  if (!showInstructionsModal) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="inst-title">
      <div className="modal-card instructions-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <ShieldCheck size={22} className="text-yellow" />
            <h2 id="inst-title">Manual de Juego · PRL-OCA 3D ONLINE</h2>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setShowInstructionsModal(false)}
            aria-label="Cerrar instrucciones"
          >
            <X size={20} />
          </button>
        </div>

        <div className="instructions-body">
          <section className="inst-block">
            <h3>
              <Compass size={18} /> 1. Objetivo del Recorrido de 48 Casillas
            </h3>
            <p>
              Hasta <strong>15 participantes</strong> (organizados de forma predeterminada en{' '}
              <strong>3 equipos de 5 personas</strong>: Azul, Naranja y Verde) recorren un complejo
              industrial tridimensional de <strong>48 casillas</strong> distribuidas en 12 zonas
              productivas (Fábrica, Almacén, Taller, Oficinas, Construcción, Laboratorio, Hospital,
              Cocina Industrial, Muelle de Carga, Sala de Control, Subestación Eléctrica y Base de
              Emergencias).
            </p>
            <ul>
              <li>
                <strong>Ocas Preventivas (Casillas 5, 11, 17, 23, 29, 35 y 41):</strong>{' '}
                <em>"De punto seguro a punto seguro y tiro porque la prevención es mi escudo"</em>.
                Premian las buenas prácticas certificadas haciendo avanzar a la siguiente Oca
                Preventiva con +15/+20 puntos y tirada adicional.
              </li>
              <li>
                <strong>Desafíos 3D Interactivos:</strong> 8 minipruebas tridimensionales donde el
                equipo inspecciona talleres, viste EPIs, evacúa edificios o apaga conatos de
                incendio directamente en 3D (40-50 pts).
              </li>
              <li>
                <strong>Meta Cero Accidentes (Casilla #48):</strong> Al llegar a la casilla 48 y
                superar el reto final de validación preventiva, el equipo conquista la victoria.
              </li>
            </ul>
          </section>

          <section className="inst-block">
            <h3>
              <Users size={18} /> 2. Roles Rotativos de Equipo en Cada Turno
            </h3>
            <p>
              Para garantizar que los 5 miembros de cada equipo participen activamente, el servidor
              rota automáticamente las responsabilidades en cada turno:
            </p>
            <div className="inst-roles-grid">
              {TEAM_ROLES_ORDER.map((r) => (
                <div key={r} className="inst-role-card">
                  <strong>{TEAM_ROLE_INFO[r].title}</strong>
                  <p>{TEAM_ROLE_INFO[r].shortDesc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="inst-block">
            <h3>
              <Award size={18} /> 3. Insignias 3D Desbloqueables
            </h3>
            <div className="inst-badges-grid">
              {BADGE_DEFINITIONS.map((b) => (
                <div key={b.id} className="inst-badge-card" style={{ borderLeftColor: b.color }}>
                  <strong>{b.name}</strong>
                  <p>{b.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
