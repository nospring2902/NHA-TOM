import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { PresenceService } from './presence.service';

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  constructor(private readonly presenceService: PresenceService) {}

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    if (!this.server) {
      return;
    }

    const socketIds = this.presenceService.getSocketIds(userId);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit(event, payload);
    }
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }
}
