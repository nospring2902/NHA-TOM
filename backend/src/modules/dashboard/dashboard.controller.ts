import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/ponds/:pondId/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get('score')
  score(@Param('pondId') pondId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.dashboardService.score(pondId, userId);
  }

  @Get('realtime')
  realtime(@Param('pondId') pondId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.dashboardService.realtime(pondId, userId);
  }
}
