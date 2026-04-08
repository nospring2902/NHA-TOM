import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { AdminProvisionDeviceDto } from './dto/admin-provision-device.dto';
import { AdminDeviceService } from './admin-device.service';

@Controller('api/v1/admin/devices')
export class AdminDeviceController {
  constructor(
    private readonly adminDeviceService: AdminDeviceService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Post('provision')
  provision(@Body() payload: AdminProvisionDeviceDto, @Req() req: Request) {
    const admin = this.authContextService.requireAdmin(req);
    return this.adminDeviceService.provision(payload.serialNumber, admin.sub);
  }

  @Get()
  listAll(@Req() req: Request) {
    this.authContextService.requireAdmin(req);
    return this.adminDeviceService.listAllDevices();
  }

  @Get(':id/access-token')
  getAccessToken(@Param('id') id: string, @Req() req: Request) {
    this.authContextService.requireAdmin(req);
    return this.adminDeviceService.getAccessToken(id);
  }
}
