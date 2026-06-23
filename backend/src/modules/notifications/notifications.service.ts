import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../friends/realtime.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Create a notification and emit via WebSocket.
   */
  async create(
    userId: string,
    type: string,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });

    this.realtimeService.emitToUser(userId, 'notification:new', notification);

    return notification;
  }

  /**
   * List notifications for a user (newest first, paginated).
   */
  async list(userId: string, limit = 20, cursor?: string) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return {
      success: true,
      message: 'List notifications',
      data: notifications,
    };
  }

  /**
   * Get unread notification count.
   */
  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return {
      success: true,
      message: 'Unread count',
      data: { count },
    };
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    });

    return {
      success: true,
      message: 'Marked as read',
    };
  }

  /**
   * Mark all notifications as read.
   */
  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return {
      success: true,
      message: 'All marked as read',
    };
  }
}
