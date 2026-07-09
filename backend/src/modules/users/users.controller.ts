import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { AuthContextService } from '../auth/auth-context.service';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { RequestPasswordChangeDto } from './dto/request-password-change.dto';
import { ConfirmPasswordChangeDto } from './dto/confirm-password-change.dto';

const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');

const ensureAvatarUploadDir = () => {
  if (!existsSync(AVATAR_UPLOAD_DIR)) {
    mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
  }
};

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

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          ensureAvatarUploadDir();
          callback(null, AVATAR_UPLOAD_DIR);
        },
        filename: (_req, file, callback) => {
          const timestamp = Date.now();
          const randomPart = Math.random().toString(16).slice(2, 10);
          const extension = extname(file.originalname || '') || '.jpg';
          callback(null, `avatar-${timestamp}-${randomPart}${extension}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Chỉ hỗ trợ tải ảnh'), false);
          return;
        }

        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);

    if (!file) {
      throw new BadRequestException('Ảnh không hợp lệ');
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const url = `${origin}/uploads/avatars/${file.filename}`;

    return this.usersService.updateAvatar(userId, url);
  }

  @Post('me/change-password/request')
  requestPasswordChange(@Body() payload: RequestPasswordChangeDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.usersService.requestPasswordChange(userId, payload);
  }

  @Post('me/change-password/confirm')
  confirmPasswordChange(@Body() payload: ConfirmPasswordChangeDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.usersService.confirmPasswordChange(userId, payload);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: Request) {
    this.authContextService.requireCurrentUserId(req);
    return this.usersService.getById(id);
  }
}
