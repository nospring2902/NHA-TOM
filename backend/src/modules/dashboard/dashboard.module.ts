import { Module } from '@nestjs/common';
import { AiForecastService } from './ai-forecast.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, AiForecastService],
})
export class DashboardModule {}
