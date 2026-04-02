import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { GetMetricHistoryDto } from './dto/get-metric-history.dto';
import { MetricsService } from './metrics.service';

@Controller('api/v1/ponds/:pondId/metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get('latest')
  latest(@Param('pondId') pondId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.metricsService.latest(pondId, userId);
  }

  @Get('history')
  history(
    @Param('pondId') pondId: string,
    @Query() query: GetMetricHistoryDto,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.metricsService.history(pondId, userId, query);
  }
}
