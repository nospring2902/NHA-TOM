import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from './auth-context.service';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SetPhoneDto } from './dto/set-phone.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';

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
  @Post('verify-phone')
  async verifyPhone(@Body() payload: VerifyPhoneDto) {
    return this.authService.verifyPhone(payload.email, payload.code);
  }

  @Public()
  @Post('resend-email')
  async resendEmail(@Body() payload: ResendVerificationDto) {
    return this.authService.resendEmailVerification(payload.email);
  }

  @Public()
  @Post('resend-phone')
  async resendPhone(@Body() payload: ResendVerificationDto) {
    return this.authService.resendPhoneVerification(payload.email);
  }

  @Public()
  @Post('set-phone')
  async setPhone(@Body() payload: SetPhoneDto) {
    return this.authService.setPhone(payload);
  }

  @Get('me')
  async me(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.authService.me(userId);
  }
}
