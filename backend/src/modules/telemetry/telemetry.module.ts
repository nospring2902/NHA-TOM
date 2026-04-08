import { Module } from '@nestjs/common';
import { DeviceTokenCipherService } from '../devices/device-token-cipher.service';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService, DeviceTokenCipherService],
})
export class TelemetryModule {}
