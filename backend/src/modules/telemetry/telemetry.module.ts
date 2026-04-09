import { Module } from '@nestjs/common';
import { DeviceTokenCipherService } from '../devices/device-token-cipher.service';
import { DeviceStatusTask } from './device-status.task';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService, DeviceTokenCipherService, DeviceStatusTask],
})
export class TelemetryModule {}
