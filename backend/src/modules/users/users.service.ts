import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { VerificationService } from '../auth/verification.service';
import { createUserPasswordHash, verifyUserPassword } from '../../utils/password.util';
import { UpdateMeDto } from './dto/update-me.dto';
import { RequestPasswordChangeDto } from './dto/request-password-change.dto';
import { ConfirmPasswordChangeDto } from './dto/confirm-password-change.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
  ) {}

  async getMe(userId: string) {
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
      message: 'Get profile successfully',
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async updateMe(userId: string, payload: UpdateMeDto) {
    const nextData: {
      fullName?: string;
      phone?: string | null;
    } = {};

    if (payload.fullName) {
      nextData.fullName = payload.fullName.trim();
    }

    if (payload.phone) {
      nextData.phone = payload.phone.trim();
    }

    const updated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: nextData,
    });

    return {
      success: true,
      message: 'Update profile successfully',
      data: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
        role: updated.role,
        updatedAt: updated.updatedAt,
      },
    };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const updated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarUrl,
      },
    });

    return {
      success: true,
      message: 'Update avatar successfully',
      data: {
        id: updated.id,
        avatarUrl: updated.avatarUrl,
      },
    };
  }

  async requestPasswordChange(userId: string, payload: RequestPasswordChangeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!verifyUserPassword(payload.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    if (verifyUserPassword(payload.newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        pendingPasswordHash: createUserPasswordHash(payload.newPassword),
      },
    });

    const refreshedUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    const emailSent = await this.verificationService.issuePasswordChangeCode(refreshedUser);

    if (!emailSent) {
      throw new BadRequestException('Không thể gửi mã xác nhận, vui lòng thử lại');
    }

    return {
      success: true,
      message: 'Đã gửi mã xác nhận đổi mật khẩu tới email của bạn',
      data: {
        email: user.email,
      },
    };
  }

  async confirmPasswordChange(userId: string, payload: ConfirmPasswordChangeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (!user.pendingPasswordHash) {
      throw new BadRequestException('Không có yêu cầu đổi mật khẩu nào đang chờ xác nhận');
    }

    this.verificationService.assertPasswordChangeCode(user, payload.code.trim());

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: user.pendingPasswordHash as string,
          pendingPasswordHash: null,
          passwordChangeCodeHash: null,
          passwordChangeExpiresAt: null,
        },
      });

      await tx.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });

    return {
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return {
      success: true,
      message: 'Get profile successfully',
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }
}
