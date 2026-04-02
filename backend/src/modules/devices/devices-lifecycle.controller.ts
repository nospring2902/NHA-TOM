import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { PondsService } from '../ponds/ponds.service';
import { BindDeviceDto } from '../ponds/dto/bind-device.dto';
import { BindDeviceToPondDto } from './dto/bind-device-to-pond.dto';
import { DevicesService } from './devices.service';

@Controller('api/v1/devices')
export class DevicesLifecycleController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly pondsService: PondsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Post('bind')
  async bind(@Body() payload: BindDeviceToPondDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);

    // Reuse the existing pond binding implementation to avoid duplication.
    const dto: BindDeviceDto = {
      serialNumber: payload.serialNumber,
    };

    return this.pondsService.bindDevice(payload.pondId, userId, dto);
  }

  @Post(':id/start')
  start(@Param('id') deviceId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.devicesService.start(deviceId, userId);
  }

  @Post(':id/stop')
  stop(@Param('id') deviceId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.devicesService.stop(deviceId, userId);
  }
}
