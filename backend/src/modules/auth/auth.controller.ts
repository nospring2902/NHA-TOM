import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from './auth-context.service';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Public()
  @Post('login')
  async login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() payload: RefreshTokenDto) {
    return this.authService.refresh(payload);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() payload: VerifyEmailDto) {
    return this.authService.verifyEmail(payload.email, payload.code);
  }

  @Public()
  @Post('resend-email')
  async resendEmail(@Body() payload: ResendVerificationDto) {
    return this.authService.resendEmailVerification(payload.email);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload.email);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload.email, payload.code, payload.newPassword);
  }

  @Get('me')
  async me(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.authService.me(userId);
  }
}
