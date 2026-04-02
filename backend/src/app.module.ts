import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DevicesModule } from './modules/devices/devices.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PondsModule } from './modules/ponds/ponds.module';
import { PostsModule } from './modules/posts/posts.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PondsModule,
    MetricsModule,
    DashboardModule,
    AlertsModule,
    ActivityLogsModule,
    DevicesModule,
    PostsModule,
    TelemetryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
