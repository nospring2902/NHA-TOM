import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User, type UserSession } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { createUserPasswordHash, verifyUserPassword } from '../../utils/password.util';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPhoneDto } from './dto/set-phone.dto';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly verificationService: VerificationService,
  ) {}

  async register(payload: RegisterDto) {
    const email = payload.email.trim().toLowerCase();
    const fullName = payload.fullName.trim();
    const phone = payload.phone.trim();

    if (!phone) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const adminUser = await tx.user.findFirst({
          where: {
            role: 'ADMIN',
          },
          select: {
            id: true,
          },
        });

        const createdUser = await tx.user.create({
          data: {
            email,
            fullName,
            phone,
            passwordHash: createUserPasswordHash(payload.password),
            role: 'FARM_MANAGER',
          },
        });

        if (adminUser) {
          await tx.friend.createMany({
            data: [
              {
                userId: createdUser.id,
                friendId: adminUser.id,
              },
              {
                userId: adminUser.id,
                friendId: createdUser.id,
              },
            ],
            skipDuplicates: true,
          });
        }

        return createdUser;
      });

      const [emailSent, phoneSent] = await Promise.all([
        this.verificationService.issueEmailVerification(user),
        this.verificationService.issuePhoneVerification(user),
      ]);

      return {
        success: true,
        message: 'Đăng ký thành công. Vui lòng xác minh email và số điện thoại',
        data: {
          email: user.email,
          phone: user.phone,
          emailSent,
          phoneSent,
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

    if (user.role !== 'ADMIN') {
      if (!user.emailVerifiedAt) {
        throw new ForbiddenException('Vui lòng xác minh email trước khi đăng nhập');
      }

      if (!user.phone || !user.phoneVerifiedAt) {
        throw new ForbiddenException('Vui lòng xác minh số điện thoại trước khi đăng nhập');
      }
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

    if (session.user.role !== 'ADMIN') {
      if (!session.user.emailVerifiedAt || !session.user.phoneVerifiedAt || !session.user.phone) {
        throw new ForbiddenException('Vui lòng xác minh email và số điện thoại trước khi đăng nhập');
      }
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

  async verifyEmail(email: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    await this.verificationService.verifyEmailCode(user, code.trim());

    return {
      success: true,
      message: 'Xác minh email thành công',
    };
  }

  async verifyPhone(email: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    await this.verificationService.verifyPhoneCode(user, code.trim());

    return {
      success: true,
      message: 'Xác minh số điện thoại thành công',
    };
  }

  async setPhone(payload: SetPhoneDto) {
    const email = payload.email.trim().toLowerCase();
    const phone = payload.phone.trim();

    if (!phone) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !verifyUserPassword(payload.password, user.passwordHash)) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phone,
        phoneVerifiedAt: null,
        phoneVerificationCodeHash: null,
        phoneVerificationExpiresAt: null,
      },
    });

    const phoneSent = await this.verificationService.issuePhoneVerification(updated);
    if (!phoneSent) {
      throw new BadRequestException('Không thể gửi mã OTP, vui lòng thử lại');
    }

    return {
      success: true,
      message: 'Đã cập nhật số điện thoại và gửi mã OTP',
    };
  }

  async resendEmailVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (user.emailVerifiedAt) {
      return {
        success: true,
        message: 'Email đã được xác minh',
      };
    }

    const emailSent = await this.verificationService.issueEmailVerification(user);

    if (!emailSent) {
      throw new BadRequestException('Không thể gửi lại mã, vui lòng thử lại');
    }

    return {
      success: true,
      message: 'Đã gửi lại mã xác minh email',
    };
  }

  async resendPhoneVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!user.phone) {
      throw new BadRequestException('Vui lòng cập nhật số điện thoại trước khi xác minh');
    }

    if (user.phoneVerifiedAt) {
      return {
        success: true,
        message: 'Số điện thoại đã được xác minh',
      };
    }

    const phoneSent = await this.verificationService.issuePhoneVerification(user);

    if (!phoneSent) {
      throw new BadRequestException('Không thể gửi lại mã, vui lòng thử lại');
    }

    return {
      success: true,
      message: 'Đã gửi lại mã OTP',
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
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
