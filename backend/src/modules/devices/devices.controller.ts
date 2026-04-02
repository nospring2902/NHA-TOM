import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { CreateDeviceCommandDto } from './dto/create-device-command.dto';
import { DevicesService } from './devices.service';

@Controller('api/v1/ponds/:pondId/devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  list(@Param('pondId') pondId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.devicesService.list(pondId, userId);
  }

  @Post(':deviceId/commands')
  command(
    @Param('pondId') pondId: string,
    @Param('deviceId') deviceId: string,
    @Body() payload: CreateDeviceCommandDto,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.devicesService.command(pondId, deviceId, payload, userId);
  }
}
