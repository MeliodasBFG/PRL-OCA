import React from 'react';
import {
  BOARD_TILES,
  INDUSTRIAL_ZONE_LABELS,
  PRL_CATEGORY_LABELS,
  TILE_TYPE_LABELS,
  Team,
  TileDefinition,
} from '@prl-oca/shared';
import { getContrastTextColor } from '../utils/mobileOrientation';

interface Board2DFallbackProps {
  teams: Team[];
  activeTeamId?: string;
  onSelectTile?: (tile: TileDefinition) => void;
}

export const Board2DFallback: React.FC<Board2DFallbackProps> = ({
  teams,
  activeTeamId,
  onSelectTile,
}) => {
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? teams[0];

  return (
    <div className="board-2d-container" role="region" aria-label="Tablero de 48 casillas PRL-OCA">
      <div className="board-2d-header">
        <div>
          <h3>Recorrido Preventivo de 48 Casillas (Vista Táctica 2D)</h3>
          <p>
            Pulsa sobre cualquier casilla para inspeccionar su zona industrial, categoría PRL y
            efectos especiales.
          </p>
        </div>
        <div className="board-2d-legend">
          <span className="legend-pill" style={{ borderColor: '#10B981' }}>
            Oca Preventiva (+15 pts + Tirada extra)
          </span>
          <span className="legend-pill" style={{ borderColor: '#7C3AED' }}>
            Desafío 3D Interactivo (40-50 pts)
          </span>
          <span className="legend-pill" style={{ borderColor: '#FFB800' }}>
            Meta Cero Accidentes (#48)
          </span>
        </div>
      </div>

      <div className="board-2d-grid">
        {BOARD_TILES.map((tile) => {
          const occupants = teams.filter((t) => t.position === tile.index);
          const isCurrentActive = activeTeam?.position === tile.index;

          return (
            <button
              key={tile.index}
              type="button"
              onClick={() => onSelectTile?.(tile)}
              className={`tile-2d-card ${isCurrentActive ? 'tile-2d-active' : ''}`}
              style={{
                borderColor: isCurrentActive ? '#FFB800' : tile.color,
              }}
              aria-label={`Casilla ${tile.index}: ${tile.name} (${TILE_TYPE_LABELS[tile.type]})`}
            >
              <div className="tile-2d-top">
                <span
                  className="tile-2d-num"
                  style={{
                    background: tile.color,
                    color: getContrastTextColor(tile.color),
                  }}
                >
                  #{tile.index}
                </span>
                <span className="tile-2d-zone">{INDUSTRIAL_ZONE_LABELS[tile.zone]}</span>
              </div>
              <div className="tile-2d-name">{tile.name}</div>
              <div className="tile-2d-cat">{PRL_CATEGORY_LABELS[tile.category]}</div>
              {occupants.length > 0 && (
                <div className="tile-2d-tokens">
                  {occupants.map((team) => (
                    <span
                      key={team.id}
                      className="tile-2d-token-chip"
                      style={{ backgroundColor: team.hexColor }}
                    >
                      {team.name.split('(')[0].trim()}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
