import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { BindDeviceDto } from './dto/bind-device.dto';
import { CreatePondDto } from './dto/create-pond.dto';
import { UpdatePondDto } from './dto/update-pond.dto';
import { PondsService } from './ponds.service';

@Controller('api/v1/ponds')
export class PondsController {
  constructor(
    private readonly pondsService: PondsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Post()
  create(@Body() payload: CreatePondDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.pondsService.create(userId, payload);
  }

  @Get()
  list(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.pondsService.list(userId);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.pondsService.getById(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: UpdatePondDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.pondsService.update(id, userId, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.pondsService.remove(id, userId);
  }

  @Post(':id/bind-device')
  bindDevice(
    @Param('id') pondId: string,
    @Body() payload: BindDeviceDto,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.pondsService.bindDevice(pondId, userId, payload);
  }

  @Get(':id/devices/:deviceId/telemetry-status')
  getTelemetryStatus(
    @Param('id') pondId: string,
    @Param('deviceId') deviceId: string,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.pondsService.getTelemetryStatus(pondId, deviceId, userId);
  }
}
