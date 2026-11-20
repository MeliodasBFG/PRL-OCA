import {
  ClientToServerMessage,
  GameRoomState,
  ServerToClientMessage,
  normalizeRoomCode,
} from '@prl-oca/shared';
import { resolveWebSocketUrl } from '../utils/networkConfig';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'local_sync';

const WS_CONNECT_TIMEOUT_MS = 8000;
const WS_RECONNECT_DELAY_MS = 2500;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private roomCode = '';
  private onMessageCallback: ((msg: ServerToClientMessage) => void) | null = null;
  private onStatusCallback: ((status: ConnectionState) => void) | null = null;
  private joinPayload: Extract<ClientToServerMessage, { type: 'JOIN_ROOM' }> | null = null;
  private intentionalClose = false;
  private useLocalBroadcast = true;

  public connect(
    roomCode: string,
    joinMsg: Extract<ClientToServerMessage, { type: 'JOIN_ROOM' }>,
    onMessage: (msg: ServerToClientMessage) => void,
    onStatus: (status: ConnectionState) => void,
    options?: { useLocalBroadcast?: boolean }
  ): void {
    this.disconnect();
    this.intentionalClose = false;
    this.roomCode = normalizeRoomCode(roomCode);
    this.joinPayload = joinMsg;
    this.onMessageCallback = onMessage;
    this.onStatusCallback = onStatus;
    this.useLocalBroadcast = options?.useLocalBroadcast ?? true;

    // Cross-tab BroadcastChannel is only enabled for pure offline multi-tab demo mode
    if (this.useLocalBroadcast && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(`prl_oca_room_${this.roomCode}`);
      this.channel.onmessage = (ev) => {
        if (ev.data && this.onMessageCallback) {
          this.onMessageCallback(ev.data as ServerToClientMessage);
        }
      };
    }

    this.openWebSocket();
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(delayMs = WS_RECONNECT_DELAY_MS): void {
    this.clearReconnectTimer();
    if (this.intentionalClose || !this.roomCode) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) {
        this.openWebSocket();
      }
    }, delayMs);
  }

  private openWebSocket(): void {
    const wsUrl = resolveWebSocketUrl(this.roomCode);
    if (!wsUrl) {
      this.onStatusCallback?.('local_sync');
      return;
    }

    this.clearConnectTimeout();
    this.clearReconnectTimer();
    this.onStatusCallback?.('connecting');

    try {
      const sock = new WebSocket(wsUrl);
      this.ws = sock;

      this.connectTimeout = setTimeout(() => {
        if (this.ws !== sock) return;
        if (sock.readyState !== WebSocket.OPEN) {
          console.warn(`[PRL-OCA][WS] Handshake timeout after ${WS_CONNECT_TIMEOUT_MS}ms (${wsUrl})`);
          try {
            sock.close();
          } catch {
            // Ignore
          }
          this.onStatusCallback?.(this.useLocalBroadcast ? 'local_sync' : 'disconnected');
        }
      }, WS_CONNECT_TIMEOUT_MS);

      sock.onopen = () => {
        if (this.ws !== sock) return;
        this.clearConnectTimeout();
        this.clearReconnectTimer();
        console.info(`[PRL-OCA][WS] Connected to room ${this.roomCode} (${wsUrl})`);
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
        if (this.ws !== sock) return;
        try {
          const parsed = JSON.parse(String(event.data)) as ServerToClientMessage;
          this.onMessageCallback?.(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      sock.onerror = () => {
        if (this.ws !== sock) return;
        this.clearConnectTimeout();
        console.warn(`[PRL-OCA][WS] Socket error on room ${this.roomCode}`);
        this.onStatusCallback?.(this.useLocalBroadcast ? 'local_sync' : 'disconnected');
      };

      sock.onclose = (ev) => {
        if (this.ws !== sock) return;
        this.clearConnectTimeout();
        this.stopPing();
        this.ws = null;
        if (!this.intentionalClose) {
          console.warn(
            `[PRL-OCA][WS] Closed on room ${this.roomCode} (code=${ev.code}); scheduling reconnect`
          );
          this.onStatusCallback?.(this.useLocalBroadcast ? 'local_sync' : 'disconnected');
          this.scheduleReconnect();
        }
      };
    } catch {
      this.onStatusCallback?.(this.useLocalBroadcast ? 'local_sync' : 'disconnected');
      this.scheduleReconnect();
    }
  }

  public isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  public forceReconnectIfNeeded(): void {
    if (this.intentionalClose || !this.roomCode || !this.joinPayload) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.openWebSocket();
  }

  public send(msg: ClientToServerMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  public updateJoinPlayerId(
    playerId: string,
    playerToken?: string,
    teacherToken?: string
  ): void {
    if (this.joinPayload) {
      this.joinPayload = {
        ...this.joinPayload,
        playerId,
        ...(playerToken ? { playerToken } : {}),
        ...(teacherToken ? { teacherToken } : {}),
      };
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
    this.clearConnectTimeout();
    this.clearReconnectTimer();
    const currentWs = this.ws;
    this.ws = null;
    if (currentWs) {
      try {
        currentWs.close();
      } catch {
        // Ignore
      }
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.roomCode = '';
    this.onStatusCallback?.('disconnected');
  }
}

export const mpClient = new MultiplayerClient();
