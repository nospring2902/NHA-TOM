import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenClaims } from './token.service';
import { TokenService } from './token.service';

type AuthenticatedRequest = Request & {
  user?: AccessTokenClaims;
};

@Injectable()
export class AuthContextService {
  constructor(private readonly tokenService: TokenService) {}

  getCurrentUser(req: Request): AccessTokenClaims | null {
    const claimsFromGuard = (req as AuthenticatedRequest).user;
    if (claimsFromGuard?.sub) {
      return claimsFromGuard;
    }

    const authHeader = req.header('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      const claims = this.tokenService.verifyAccessToken(token);
      if (claims?.sub) {
        return claims;
      }
    }

    return null;
  }

  getCurrentUserId(req: Request): string | null {
    return this.getCurrentUser(req)?.sub ?? null;
  }

  requireCurrentUser(req: Request): AccessTokenClaims {
    const claims = this.getCurrentUser(req);
    if (!claims) {
      throw new UnauthorizedException('Bạn cần đăng nhập để sử dụng chức năng này');
    }

    return claims;
  }

  requireCurrentUserId(req: Request): string {
    return this.requireCurrentUser(req).sub;
  }

  requireAdmin(req: Request): AccessTokenClaims {
    const claims = this.requireCurrentUser(req);

    if (claims.role !== 'ADMIN') {
      throw new ForbiddenException('Chỉ quản trị viên mới có quyền thực hiện thao tác này');
    }

    return claims;
  }
}