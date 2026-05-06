import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private readonly onlineUsers = new Map<string, Set<string>>();

  markOnline(userId: string, socketId: string) {
    const sockets = this.onlineUsers.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.onlineUsers.set(userId, sockets);
  }

  markOffline(userId: string, socketId: string): boolean {
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) {
      return false;
    }

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.onlineUsers.delete(userId);
      return false;
    }

    return true;
  }

  isOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  getSocketIds(userId: string): string[] {
    return Array.from(this.onlineUsers.get(userId) ?? []);
  }
}
