import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User, type UserSession } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { createUserPasswordHash, verifyUserPassword } from '../../utils/password.util';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async register(payload: RegisterDto) {
    const email = payload.email.trim().toLowerCase();
    const fullName = payload.fullName.trim();

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          fullName,
          passwordHash: createUserPasswordHash(payload.password),
          role: 'FARM_MANAGER',
        },
      });

      const tokens = await this.issueSessionTokens(user);

      return {
        success: true,
        message: 'Đăng ký thành công',
        data: {
          ...tokens,
          user: this.serializeUser(user),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email đã được sử dụng');
      }

      throw new BadRequestException('Không thể tạo tài khoản, vui lòng thử lại');
    }
  }

  async login(payload: LoginDto) {
    const email = payload.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !verifyUserPassword(payload.password, user.passwordHash)) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const tokens = await this.issueSessionTokens(user);

    return {
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        ...tokens,
        user: this.serializeUser(user),
      },
    };
  }

  async refresh(payload: RefreshTokenDto) {
    const refreshTokenHash = this.tokenService.hashRefreshToken(payload.refreshToken);

    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const newRefreshToken = this.tokenService.generateRefreshToken();
    const newRefreshTokenHash = this.tokenService.hashRefreshToken(newRefreshToken);
    const nextExpiresAt = this.tokenService.getRefreshTokenExpiryDate();

    await this.prisma.userSession.update({
      where: {
        id: session.id,
      },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: nextExpiresAt,
      },
    });

    const accessToken = this.tokenService.issueAccessToken({
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role,
    });

    return {
      success: true,
      message: 'Làm mới token thành công',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return {
      success: true,
      message: 'Lấy thông tin người dùng thành công',
      data: this.serializeUser(user),
    };
  }

  private async issueSessionTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
    session: Pick<UserSession, 'id' | 'expiresAt'>;
  }> {
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const expiresAt = this.tokenService.getRefreshTokenExpiryDate();

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    const accessToken = this.tokenService.issueAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken,
      session,
    };
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
