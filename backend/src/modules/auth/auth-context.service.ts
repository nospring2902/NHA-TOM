import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenClaims } from './token.service';
import { TokenService } from './token.service';

type AuthenticatedRequest = Request & {
  user?: AccessTokenClaims;
};

@Injectable()
export class AuthContextService {
  constructor(private readonly tokenService: TokenService) {}

  getCurrentUserId(req: Request): string | null {
    const claimsFromGuard = (req as AuthenticatedRequest).user;
    if (claimsFromGuard?.sub) {
      return claimsFromGuard.sub;
    }

    const authHeader = req.header('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      const claims = this.tokenService.verifyAccessToken(token);
      if (claims?.sub) {
        return claims.sub;
      }
    }

    return null;
  }

  requireCurrentUserId(req: Request): string {
    const userId = this.getCurrentUserId(req);
    if (!userId) {
      throw new UnauthorizedException('Bạn cần đăng nhập để sử dụng chức năng này');
    }

    return userId;
  }
}