import { Module } from '@nestjs/common';
import { PondsModule } from '../ponds/ponds.module';
import { DevicesController } from './devices.controller';
import { DevicesLifecycleController } from './devices-lifecycle.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [PondsModule],
  controllers: [DevicesController, DevicesLifecycleController],
  providers: [DevicesService],
})
export class DevicesModule {}
