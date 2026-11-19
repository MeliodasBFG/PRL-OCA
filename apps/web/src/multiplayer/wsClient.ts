import {
  ClientToServerMessage,
  GameRoomState,
  ServerToClientMessage,
} from '@prl-oca/shared';
import { resolveWebSocketUrl } from '../utils/networkConfig';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'local_sync';

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private roomCode = '';
  private onMessageCallback: ((msg: ServerToClientMessage) => void) | null = null;
  private onStatusCallback: ((status: ConnectionState) => void) | null = null;
  private joinPayload: Extract<ClientToServerMessage, { type: 'JOIN_ROOM' }> | null = null;
  private intentionalClose = false;

  public connect(
    roomCode: string,
    joinMsg: Extract<ClientToServerMessage, { type: 'JOIN_ROOM' }>,
    onMessage: (msg: ServerToClientMessage) => void,
    onStatus: (status: ConnectionState) => void
  ): void {
    this.disconnect();
    this.intentionalClose = false;
    this.roomCode = roomCode.toUpperCase();
    this.joinPayload = joinMsg;
    this.onMessageCallback = onMessage;
    this.onStatusCallback = onStatus;

    // Set up cross-tab BroadcastChannel synchronization as immediate backup
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(`prl_oca_room_${this.roomCode}`);
      this.channel.onmessage = (ev) => {
        if (ev.data && this.onMessageCallback) {
          this.onMessageCallback(ev.data as ServerToClientMessage);
        }
      };
    }

    this.openWebSocket();
  }

  private openWebSocket(): void {
    const wsUrl = resolveWebSocketUrl(this.roomCode);
    if (!wsUrl) {
      this.onStatusCallback?.('local_sync');
      return;
    }

    this.onStatusCallback?.('connecting');

    try {
      const sock = new WebSocket(wsUrl);
      this.ws = sock;

      const fallbackTimeout = setTimeout(() => {
        if (sock.readyState !== WebSocket.OPEN) {
          try {
            sock.close();
          } catch {
            // Ignore
          }
          this.onStatusCallback?.('local_sync');
        }
      }, 2200);

      sock.onopen = () => {
        clearTimeout(fallbackTimeout);
        this.onStatusCallback?.('connected');
        if (this.joinPayload) {
          // Always generate a fresh actionId so server deduplication never drops a reconnect JOIN_ROOM
          this.send({
            ...this.joinPayload,
            actionId: `join_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          });
        }
        this.startPing();
      };

      sock.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as ServerToClientMessage;
          this.onMessageCallback?.(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      sock.onerror = () => {
        clearTimeout(fallbackTimeout);
        this.onStatusCallback?.('local_sync');
      };

      sock.onclose = () => {
        clearTimeout(fallbackTimeout);
        this.stopPing();
        if (!this.intentionalClose) {
          this.onStatusCallback?.('local_sync');
          this.reconnectTimer = setTimeout(() => {
            if (!this.intentionalClose) {
              this.openWebSocket();
            }
          }, 5000);
        }
      };
    } catch {
      this.onStatusCallback?.('local_sync');
    }
  }

  public send(msg: ClientToServerMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  public updateJoinPlayerId(playerId: string): void {
    if (this.joinPayload) {
      this.joinPayload = { ...this.joinPayload, playerId };
    }
  }

  public broadcastLocalState(state: GameRoomState): void {
    const code = state.roomCode.toUpperCase();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`prl_oca_room_state_${code}`, JSON.stringify(state));
      } catch {
        // Ignore
      }
    }
    const msg: ServerToClientMessage = {
      type: 'STATE_SYNC',
      state,
    };
    if (this.channel && this.roomCode === code) {
      this.channel.postMessage(msg);
      return;
    }
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const tempChannel = new BroadcastChannel(`prl_oca_room_${code}`);
      tempChannel.postMessage(msg);
      tempChannel.close();
    }
  }

  public loadCachedRoomState(roomCode: string): GameRoomState | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(
        `prl_oca_room_state_${roomCode.toUpperCase()}`
      );
      return raw ? (JSON.parse(raw) as GameRoomState) : null;
    } catch {
      return null;
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, 20000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.onStatusCallback?.('disconnected');
  }
}

export const mpClient = new MultiplayerClient();
