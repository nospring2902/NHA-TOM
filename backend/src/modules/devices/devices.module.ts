import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PondsModule } from '../ponds/ponds.module';
import { AdminDeviceController } from './admin-device.controller';
import { AdminDeviceService } from './admin-device.service';
import { DeviceTokenCipherService } from './device-token-cipher.service';
import { DevicesController } from './devices.controller';
import { DevicesLifecycleController } from './devices-lifecycle.controller';
import { DevicesService } from './devices.service';
import { ThingsboardService } from './thingsboard.service';

@Module({
  imports: [PondsModule, HttpModule],
  controllers: [DevicesController, DevicesLifecycleController, AdminDeviceController],
  providers: [
    DevicesService,
    ThingsboardService,
    DeviceTokenCipherService,
    AdminDeviceService,
  ],
})
export class DevicesModule {}
