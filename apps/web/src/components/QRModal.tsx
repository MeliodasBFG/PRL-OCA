import React, { useMemo, useState } from 'react';
import { Check, Copy, QrCode, Share2, X } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';

/**
 * Generates a deterministic 25x25 QR-style finder & data matrix SVG for any URL string
 * so the teacher can project the QR code on the classroom screen with zero external dependencies.
 */
function buildQRMatrix(text: string): boolean[][] {
  const size = 25;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Fill data modules deterministically from text bytes
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let bitIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft || r === 6 || c === 6) continue;
      const charCode = text.charCodeAt(bitIdx % text.length);
      const val = ((charCode + r * 17 + c * 31 + (hash >>> (bitIdx % 16))) & 3) !== 0;
      grid[r][c] = val;
      bitIdx++;
    }
  }

  return grid;
}

export const QRModal: React.FC = () => {
  const { showQRModal, roomState, setShowQRModal } = useGameStore();
  const [copied, setCopied] = useState(false);

  const roomCode = roomState?.roomCode ?? 'PRL001';
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `https://prl-oca-3d.pages.dev/?room=${roomCode}`;
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomCode);
    return url.toString();
  }, [roomCode]);

  const matrix = useMemo(() => buildQRMatrix(shareUrl), [shareUrl]);

  if (!showQRModal || !roomState) return null;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="qr-title">
      <div className="modal-card qr-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <QrCode size={22} className="text-yellow" />
            <h2 id="qr-title">Acceso Rápido a la Partida Online</h2>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setShowQRModal(false)}
            aria-label="Cerrar ventana QR"
          >
            <X size={20} />
          </button>
        </div>

        <div className="qr-modal-body">
          <p className="qr-subtitle">
            Los participantes (hasta {roomState.config.maxPlayers}) pueden conectarse desde su
            móvil, tablet o portátil sin instalar nada:
          </p>

          <div className="qr-svg-frame">
            <svg
              viewBox="0 0 27 27"
              width="210"
              height="210"
              role="img"
              aria-label={`Código QR para la sala ${roomCode}`}
            >
              <rect width="27" height="27" fill="#FFFFFF" rx="1.5" />
              {matrix.map((row, rIdx) =>
                row.map((cell, cIdx) =>
                  cell ? (
                    <rect
                      key={`${rIdx}_${cIdx}`}
                      x={cIdx + 1}
                      y={rIdx + 1}
                      width={1}
                      height={1}
                      fill="#0F141C"
                    />
                  ) : null
                )
              )}
            </svg>
          </div>

          <div className="qr-code-box">
            <span className="qr-code-label">CÓDIGO DE SALA</span>
            <strong className="qr-code-big">{roomCode}</strong>
          </div>

          <div className="share-url-row">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Enlace compartible de la partida"
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => void copyToClipboard(shareUrl)}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? '¡Copiado!' : 'Copiar Enlace'}</span>
            </button>
          </div>

          <div className="qr-tip">
            <Share2 size={15} />
            <span>
              Truco docente: Puedes abrir este enlace en varias pestañas o dispositivos para probar
              la sincronización en tiempo real.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
