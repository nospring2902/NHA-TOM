import { Module } from '@nestjs/common';
import { AiForecastService } from './ai-forecast.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [CollaborationModule],
  controllers: [DashboardController],
  providers: [DashboardService, AiForecastService],
})
export class DashboardModule {}
