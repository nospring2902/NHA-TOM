import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenClaims } from '../token.service';
import { TokenService } from '../token.service';
import { VerificationService } from '../verification.service';

type AuthenticatedRequest = Request & {
  user?: AccessTokenClaims;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly verificationService: VerificationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.header('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu Bearer token hợp lệ');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Thiếu Bearer token hợp lệ');
    }

    const claims = this.tokenService.verifyAccessToken(token);
    if (!claims) {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    if (claims.role === 'ADMIN') {
      request.user = claims;
      return true;
    }

    const isVerified = await this.verificationService.isUserVerified(claims.sub);
    if (!isVerified) {
      throw new ForbiddenException('Vui lòng xác minh email và số điện thoại trước khi đăng nhập');
    }

    request.user = claims;
    return true;
  }
}
