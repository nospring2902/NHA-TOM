import { Module } from '@nestjs/common';
import { DeviceTokenCipherService } from '../devices/device-token-cipher.service';
import { AlertsModule } from '../alerts/alerts.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { FriendsModule } from '../friends/friends.module';
import { DeviceStatusBroadcaster } from './device-status-broadcaster.service';
import { DeviceStatusTask } from './device-status.task';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [AlertsModule, CollaborationModule, FriendsModule],
  controllers: [TelemetryController],
  providers: [
    TelemetryService,
    DeviceTokenCipherService,
    DeviceStatusTask,
    DeviceStatusBroadcaster,
  ],
})
export class TelemetryModule {}
