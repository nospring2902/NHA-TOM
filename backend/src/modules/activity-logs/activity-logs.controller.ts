import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { ActivityLogsService } from './activity-logs.service';

@Controller('api/v1/ponds/:pondId/activity-logs')
export class ActivityLogsController {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  list(@Param('pondId') pondId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.activityLogsService.list(pondId, userId);
  }
}
