import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async updateMe(userId: string, payload: UpdateMeDto) {
    const updated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        fullName: payload.fullName?.trim(),
      },
    });

    return {
      success: true,
      message: 'Update profile successfully',
      data: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        role: updated.role,
        updatedAt: updated.updatedAt,
      },
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
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }
}
