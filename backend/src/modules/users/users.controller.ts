import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Controller('api/v1/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get('me')
  getMe(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  updateMe(@Body() payload: UpdateMeDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.usersService.updateMe(userId, payload);
  }
}
