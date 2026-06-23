import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  list(
    @Query('limit') limit = '20',
    @Query('cursor') cursor: string | undefined,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.notificationsService.list(userId, Number(limit), cursor);
  }

  @Get('unread-count')
  unreadCount(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.notificationsService.unreadCount(userId);
  }

  @Post(':id/read')
  markRead(@Param('id') notificationId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.notificationsService.markRead(userId, notificationId);
  }

  @Post('read-all')
  markAllRead(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.notificationsService.markAllRead(userId);
  }
}
