import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { AlertsService } from './alerts.service';

@Controller('api/v1/ponds/:pondId/alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  list(@Param('pondId') pondId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.alertsService.list(pondId, userId);
  }
}
