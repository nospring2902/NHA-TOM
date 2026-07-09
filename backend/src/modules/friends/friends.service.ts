import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ChatMessage } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
    private readonly realtimeService: RealtimeService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(userId: string) {
    const friends = await this.prisma.friend.findMany({
      where: {
        userId,
        friend: {
          role: { not: 'ADMIN' },
        },
      },
      include: {
        friend: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      message: 'List friends',
      data: friends.map((relationship) => ({
        id: relationship.friend.id,
        fullName: relationship.friend.fullName,
        email: relationship.friend.email,
        isOnline: this.presenceService.isOnline(relationship.friend.id),
      })),
    };
  }

  async listRequests(userId: string) {
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        recipientId: userId,
        status: 'PENDING',
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      message: 'List friend requests',
      data: requests.map((request) => ({
        id: request.id,
        requester: request.requester,
        createdAt: request.createdAt,
      })),
    };
  }

  async listSuggestions(userId: string, limit = 6) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 12) : 6;

    const [friends, pendingOutgoing, pendingIncoming] = await this.prisma.$transaction([
      this.prisma.friend.findMany({
        where: { userId },
        select: { friendId: true },
      }),
      this.prisma.friendRequest.findMany({
        where: {
          requesterId: userId,
          status: 'PENDING',
        },
        select: { recipientId: true },
      }),
      this.prisma.friendRequest.findMany({
        where: {
          recipientId: userId,
          status: 'PENDING',
        },
        select: { requesterId: true },
      }),
    ]);

    const friendIds = new Set(friends.map((item) => item.friendId));
    const pendingOutgoingIds = new Set(pendingOutgoing.map((item) => item.recipientId));
    const pendingIncomingIds = new Set(pendingIncoming.map((item) => item.requesterId));

    const suggestions = await this.prisma.user.findMany({
      where: {
        id: {
          notIn: [userId, ...friendIds, ...pendingIncomingIds],
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: safeLimit,
    });

    return {
      success: true,
      message: 'List friend suggestions',
      data: suggestions.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isRequested: pendingOutgoingIds.has(user.id),
      })),
    };
  }

  async sendRequest(userId: string, friendId: string) {
    await this.ensureRecipient(userId, friendId);

    const existingFriendship = await this.prisma.friend.findUnique({
      where: {
        userId_friendId: {
          userId,
          friendId,
        },
      },
      select: { userId: true },
    });

    if (existingFriendship) {
      throw new ConflictException('Các bạn đã là bạn bè');
    }

    const reverseRequest = await this.prisma.friendRequest.findUnique({
      where: {
        requesterId_recipientId: {
          requesterId: friendId,
          recipientId: userId,
        },
      },
    });

    if (reverseRequest?.status === 'PENDING') {
      const accepted = await this.acceptRequest(userId, reverseRequest.id);
      return {
        success: true,
        message: 'Kết bạn thành công',
        data: {
          status: 'ACCEPTED',
          friend: accepted.friend,
        },
      };
    }

    const request = await this.prisma.friendRequest.upsert({
      where: {
        requesterId_recipientId: {
          requesterId: userId,
          recipientId: friendId,
        },
      },
      update: {
        status: 'PENDING',
      },
      create: {
        requesterId: userId,
        recipientId: friendId,
        status: 'PENDING',
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    this.realtimeService.emitToUser(friendId, 'friend:request', {
      id: request.id,
      requester: request.requester,
      createdAt: request.createdAt,
    });

    await this.notificationsService.create(
      friendId,
      'friend_request',
      'Lời mời kết bạn',
      `${request.requester.fullName} đã gửi lời mời kết bạn`,
      { requestId: request.id },
    );

    return {
      success: true,
      message: 'Đã gửi lời mời kết bạn',
      data: {
        status: 'PENDING',
        requestId: request.id,
      },
    };
  }

  async acceptRequest(userId: string, requestId: string, silent = false) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.recipientId !== userId) {
      throw new NotFoundException('Không tìm thấy lời mời kết bạn');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Lời mời đã được xử lý');
    }

    const [updatedRequest, requesterUser, recipientUser] = await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.user.findUnique({
        where: { id: request.requesterId },
        select: { id: true, fullName: true, email: true },
      }),
      this.prisma.user.findUnique({
        where: { id: request.recipientId },
        select: { id: true, fullName: true, email: true },
      }),
      this.prisma.friend.createMany({
        data: [
          {
            userId: request.recipientId,
            friendId: request.requesterId,
          },
          {
            userId: request.requesterId,
            friendId: request.recipientId,
          },
        ],
        skipDuplicates: true,
      }),
    ]);

    // Recipient (B) should see requester (A) as friend.
    const friendForRecipient =
      requesterUser ?? ({ id: request.requesterId, fullName: 'Bạn bè', email: '' } as const);

    // Requester (A) should see recipient (B) as friend.
    const friendForRequester =
      recipientUser ?? ({ id: request.recipientId, fullName: 'Bạn bè', email: '' } as const);

    if (!silent) {
      await this.notificationsService.create(
        request.requesterId,
        'friend_accepted',
        'Lời mời kết bạn được chấp nhận',
        `${friendForRequester.fullName} đã chấp nhận lời mời kết bạn của bạn`,
        { friendId: userId, requestId: request.id },
      );

      this.realtimeService.emitToUser(request.requesterId, 'friend:accepted', {
        user: {
          id: userId,
        },
        friend: friendForRequester,
      });

      this.realtimeService.emitToUser(userId, 'friend:accepted', {
        user: {
          id: userId,
        },
        friend: friendForRecipient,
      });
    }

    return {
      request: updatedRequest,
      friend: friendForRecipient,
    };
  }

  async rejectRequest(userId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.recipientId !== userId) {
      throw new NotFoundException('Không tìm thấy lời mời kết bạn');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Lời mời đã được xử lý');
    }

    const updated = await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });

    this.realtimeService.emitToUser(request.requesterId, 'friend:rejected', {
      id: request.id,
      userId,
    });

    return {
      success: true,
      message: 'Đã từ chối lời mời kết bạn',
      data: {
        id: updated.id,
        status: updated.status,
      },
    };
  }

  async listMessages(userId: string, friendId: string, limit = 50, cursor?: string) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50;

    await this.ensureRecipient(userId, friendId);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          {
            senderId: userId,
            recipientId: friendId,
          },
          {
            senderId: friendId,
            recipientId: userId,
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return {
      success: true,
      message: 'Messages list',
      data: messages.reverse().map((message) => this.serializeMessage(message)),
    };
  }

  async createMessage(userId: string, friendId: string, content: string) {
    const normalized = content.trim();
    if (!normalized) {
      throw new BadRequestException('Tin nhắn không được để trống');
    }

    await this.ensureRecipient(userId, friendId);

    const message = await this.prisma.chatMessage.create({
      data: {
        senderId: userId,
        recipientId: friendId,
        content: normalized,
      },
      include: {
        sender: {
          select: { fullName: true }
        }
      }
    });

    // Extract sender name and snippet
    const senderName = message.sender?.fullName || 'Ai đó';
    const snippet = normalized.length > 40 ? normalized.substring(0, 40) + '...' : normalized;

    await this.notificationsService.create(
      friendId,
      'chat_message',
      'Tin nhắn mới',
      `${senderName}: ${snippet}`,
      { senderId: userId, messageId: message.id },
    );

    return this.serializeMessage(message);
  }

  private async ensureRecipient(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new ForbiddenException('Không thể nhắn tin với chính mình');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: friendId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
  }

  private serializeMessage(message: ChatMessage) {
    return {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      createdAt: message.createdAt,
    };
  }
}
