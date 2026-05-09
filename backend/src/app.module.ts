import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DevicesModule } from './modules/devices/devices.module';
import { FriendsModule } from './modules/friends/friends.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PondsModule } from './modules/ponds/ponds.module';
import { PostsModule } from './modules/posts/posts.module';
import { SearchModule } from './modules/search/search.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PondsModule,
    MetricsModule,
    DashboardModule,
    AlertsModule,
    ActivityLogsModule,
    DevicesModule,
    FriendsModule,
    PostsModule,
    SearchModule,
    TelemetryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
