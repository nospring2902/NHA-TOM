import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/token.service';
import { FriendsService } from './friends.service';
import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokenService: TokenService,
    private readonly friendsService: FriendsService,
    private readonly presenceService: PresenceService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.setServer(server);
  }

  handleConnection(client: Socket) {
    const userId = this.resolveUserId(client);
    if (!userId) {
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    this.presenceService.markOnline(userId, client.id);

    client.emit('presence:sync', {
      userIds: this.presenceService.getOnlineUserIds(),
    });

    this.server.emit('presence:update', {
      userId,
      isOnline: true,
    });
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return;
    }

    const stillOnline = this.presenceService.markOffline(userId, client.id);
    if (!stillOnline) {
      this.server.emit('presence:update', {
        userId,
        isOnline: false,
      });
    }
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      toUserId?: string;
      content?: string;
    },
  ) {
    const senderId = client.data.userId as string | undefined;
    if (!senderId) {
      return {
        success: false,
        message: 'Unauthorized',
      };
    }

    const toUserId = payload?.toUserId?.trim();
    const content = payload?.content ?? '';

    if (!toUserId) {
      return {
        success: false,
        message: 'Invalid recipient',
      };
    }

    const message = await this.friendsService.createMessage(senderId, toUserId, content);

    this.realtimeService.emitToUsers([senderId, toUserId], 'chat:message', message);

    return {
      success: true,
    };
  }

  private resolveUserId(client: Socket): string | null {
    const token = this.extractToken(client);
    if (!token) {
      return null;
    }

    const claims = this.tokenService.verifyAccessToken(token);
    return claims?.sub ?? null;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string') {
      return authToken.startsWith('Bearer ') ? authToken.slice('Bearer '.length) : authToken;
    }

    const authHeader = client.handshake.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    return null;
  }
}
