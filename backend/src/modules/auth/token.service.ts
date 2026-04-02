import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

export type AccessTokenClaims = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class TokenService {
  constructor(private readonly configService: ConfigService) {}

//   issueAccessToken(claims: AccessTokenClaims): string {
//     const secret = this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'nhatom-dev-secret-change-me';
//     const expiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';

//     return jwt.sign(claims, secret, {
//       expiresIn,
//       issuer: 'nhatom-backend',
//     } satisfies SignOptions);
//   }
issueAccessToken(claims: AccessTokenClaims): string {
  const secret =
    this.configService.get<string>('JWT_ACCESS_SECRET') ??
    'nhatom-dev-secret-change-me';

  const expiresInRaw =
    this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';

  const expiresIn: SignOptions['expiresIn'] =
    /^\d+$/.test(expiresInRaw) ? Number(expiresInRaw) : (expiresInRaw as SignOptions['expiresIn']);

  return jwt.sign(claims, secret, {
    expiresIn,
    issuer: 'nhatom-backend',
  });
}

  verifyAccessToken(token: string): AccessTokenClaims | null {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'nhatom-dev-secret-change-me';

    try {
      const decoded = jwt.verify(token, secret, {
        issuer: 'nhatom-backend',
      }) as JwtPayload | string;

      if (typeof decoded === 'string') {
        return null;
      }

      const sub = typeof decoded.sub === 'string' ? decoded.sub : undefined;
      const email = typeof decoded.email === 'string' ? decoded.email : undefined;
      const role = typeof decoded.role === 'string' ? decoded.role : undefined;

      if (!sub || !email || !role) {
        return null;
      }

      return { sub, email, role };
    } catch {
      return null;
    }
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getRefreshTokenExpiryDate(): Date {
    const days = Number(this.configService.get<string>('REFRESH_TOKEN_EXPIRES_DAYS') ?? '30');
    const ttlDays = Number.isFinite(days) && days > 0 ? days : 30;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    return expiresAt;
  }
}