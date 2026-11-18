import { describe, expect, it } from 'vitest';
import { ServerToClientMessage } from '@prl-oca/shared';
import { GameRoom } from '../apps/realtime/src/durable-objects/GameRoom';

/**
 * Mock de DurableObjectState y WebSocket para simular 15 participantes simultáneos,
 * 1 profesor administrador y 1 espectador conectados a una misma sala `GameRoom`.
 */
class MockSocket {
  public inbox: ServerToClientMessage[] = [];
  private attachment: unknown = undefined;

  public send(payload: string): void {
    this.inbox.push(JSON.parse(payload) as ServerToClientMessage);
  }

  public serializeAttachment(att: unknown): void {
    this.attachment = att;
  }

  public deserializeAttachment(): unknown {
    return this.attachment;
  }

  public lastMessage(): ServerToClientMessage | undefined {
    return this.inbox[this.inbox.length - 1];
  }
}

function createMockDurableObjectState(sockets: MockSocket[]) {
  const map = new Map<string, unknown>();
  return {
    storage: {
      get: async <T>(key: string) => map.get(key) as T | undefined,
      put: async (key: string, val: unknown) => {
        map.set(key, val);
      },
    },
    getWebSockets: () => sockets as unknown as WebSocket[],
  };
}

describe('Simulación Multijugador en Tiempo Real: 15 Participantes (3 Equipos × 5) + 1 Profesor', () => {
  it('conecta 15 jugadores + 1 docente + 1 espectador, sincroniza turnos, rota roles y valida seguridad', async () => {
    const connectedSockets: MockSocket[] = [];
    const mockCtx = createMockDurableObjectState(connectedSockets);
    const room = new GameRoom(mockCtx as never, { GAME_ROOMS: {} as never });

    // 1. Profesor crea e inicializa la sala con PIN de seguridad
    const initResponse = await room.fetch(
      new Request('https://internal/init?roomCode=PRL15X', {
        method: 'POST',
        body: JSON.stringify({
          roomCode: 'PRL15X',
          teacherPin: 'SEGURIDAD2026',
          config: {
            roomName: 'Simulación Oficial 15 Alumnos',
            mode: 'teams',
            teamCount: 3,
            maxPlayers: 15,
            diceMode: '1d6',
          },
        }),
      })
    );
    expect(initResponse.status).toBe(200);
    const initJson = (await initResponse.json()) as {
      ok: boolean;
      teacherToken: string;
    };
    expect(initJson.ok).toBe(true);
    expect(initJson.teacherToken).toBeTruthy();

    // 2. Conectar Profesor por WebSocket
    const teacherSocket = new MockSocket();
    connectedSockets.push(teacherSocket);
    await room.webSocketMessage(
      teacherSocket as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'act_teacher_join',
        playerId: 'teacher_01',
        playerName: 'Prof. Prevención',
        isTeacher: true,
        teacherPin: 'SEGURIDAD2026',
      })
    );

    // 3. Conectar 15 Participantes simultáneos (se reparten en 3 equipos de 5 personas)
    const playerSockets: MockSocket[] = [];
    for (let i = 1; i <= 15; i++) {
      const sock = new MockSocket();
      connectedSockets.push(sock);
      playerSockets.push(sock);

      await room.webSocketMessage(
        sock as unknown as WebSocket,
        JSON.stringify({
          type: 'JOIN_ROOM',
          actionId: `act_join_p_${i}`,
          playerId: `player_${i}`,
          playerName: `Participante ${i}`,
        })
      );
    }

    // 4. Intentar conectar un jugador #16 -> debe ser rechazado por límite de 15 jugadores
    const extraPlayerSocket = new MockSocket();
    await room.webSocketMessage(
      extraPlayerSocket as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'act_join_p_16',
        playerId: 'player_16',
        playerName: 'Participante Extra 16',
      })
    );
    expect(extraPlayerSocket.lastMessage()?.type).toBe('ERROR');

    // 5. Pero un Espectador (Modo Proyección) sí puede conectarse además de los 15 jugadores
    const spectatorSocket = new MockSocket();
    connectedSockets.push(spectatorSocket);
    await room.webSocketMessage(
      spectatorSocket as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'act_join_spectator',
        playerId: 'spectator_01',
        playerName: 'Pantalla Aula',
        isSpectator: true,
      })
    );

    // Verificar que los 3 equipos tienen exactamente 5 integrantes y los 5 roles asignados
    const syncAfterJoins = teacherSocket.lastMessage();
    expect(syncAfterJoins?.type).toBe('STATE_SYNC');
    if (syncAfterJoins?.type === 'STATE_SYNC') {
      const st = syncAfterJoins.state;
      const participants = st.players.filter((p) => !p.isTeacher && !p.isSpectator);
      expect(participants).toHaveLength(15);

      for (const team of st.teams) {
        const teamMembers = participants.filter((p) => p.teamId === team.id);
        expect(teamMembers).toHaveLength(5);
        expect(team.currentRoles).toHaveLength(5);
      }
    }

    // 6. Profesor inicia la partida
    await room.webSocketMessage(
      teacherSocket as unknown as WebSocket,
      JSON.stringify({
        type: 'TEACHER_ACTION',
        actionId: 'act_start_game',
        teacherToken: initJson.teacherToken,
        command: { kind: 'START_GAME' },
      })
    );

    // Comprobar que TODOS los 15 jugadores, el docente y el espectador recibieron el estado "playing"
    for (const sock of connectedSockets) {
      const last = sock.lastMessage();
      expect(last?.type).toBe('STATE_SYNC');
      if (last?.type === 'STATE_SYNC') {
        expect(last.state.status).toBe('playing');
      }
    }

    // 7. Seguridad: Un jugador del Equipo 2 intenta lanzar los dados en el turno del Equipo 1 -> Rechazado
    // player_2 pertenece a team_2 (reparto equitativo 1->t1, 2->t2, 3->t3)
    await room.webSocketMessage(
      playerSockets[1] as unknown as WebSocket,
      JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'act_unauthorized_roll',
        playerId: 'player_2',
      })
    );
    expect(playerSockets[1].lastMessage()?.type).toBe('ERROR');

    // 8. Jugador del Equipo 1 (player_1) lanza los dados legítimamente
    await room.webSocketMessage(
      playerSockets[0] as unknown as WebSocket,
      JSON.stringify({
        type: 'ROLL_DICE',
        actionId: 'act_valid_roll_t1',
        playerId: 'player_1',
      })
    );

    // Verificar que los 17 clientes ven exactamente el mismo resultado de dados
    const firstClientMsg = playerSockets[0].lastMessage();
    expect(firstClientMsg?.type).toBe('DICE_ROLLED');
    if (firstClientMsg?.type === 'DICE_ROLLED') {
      const authoritativeRollTotal = firstClientMsg.roll.total;
      for (const sock of connectedSockets) {
        const msg = sock.lastMessage();
        expect(msg?.type).toBe('DICE_ROLLED');
        if (msg?.type === 'DICE_ROLLED') {
          expect(msg.roll.total).toBe(authoritativeRollTotal);
        }
      }
    }

    // 9. Probar desconexión y reconexión automática del jugador 1
    await room.webSocketClose(playerSockets[0] as unknown as WebSocket);
    await room.webSocketMessage(
      playerSockets[0] as unknown as WebSocket,
      JSON.stringify({
        type: 'JOIN_ROOM',
        actionId: 'act_reconnect_p_1',
        playerId: 'player_1',
        playerName: 'Participante 1',
      })
    );
    const reconnectedMsg = playerSockets[0].lastMessage();
    expect(reconnectedMsg?.type).toBe('STATE_SYNC');
    if (reconnectedMsg?.type === 'STATE_SYNC') {
      const p1 = reconnectedMsg.state.players.find((p) => p.id === 'player_1');
      expect(p1?.connected).toBe(true);
    }
  });
});
