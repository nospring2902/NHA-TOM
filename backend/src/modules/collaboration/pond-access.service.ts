import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type PondRole = 'OWNER' | 'MEMBER';

@Injectable()
export class PondAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user has read access to a pond (owner OR farm member).
   * Returns the user's role relative to this pond.
   */
  async assertReadAccess(pondId: string, userId: string): Promise<PondRole> {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      select: { ownerId: true },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao tôm');
    }

    if (pond.ownerId === userId) {
      return 'OWNER';
    }

    const membership = await this.prisma.farmMember.findUnique({
      where: {
        ownerId_memberId: {
          ownerId: pond.ownerId,
          memberId: userId,
        },
      },
      select: { id: true },
    });

    if (membership) {
      return 'MEMBER';
    }

    throw new ForbiddenException('Bạn không có quyền truy cập ao tôm này');
  }

  /**
   * Assert that the user is the owner of the pond.
   */
  async assertOwnerAccess(pondId: string, userId: string): Promise<void> {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      select: { ownerId: true },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao tôm');
    }

    if (pond.ownerId !== userId) {
      throw new ForbiddenException('Chỉ chủ sở hữu mới có quyền thực hiện thao tác này');
    }
  }

  /**
   * Get all pond IDs accessible by a user (owned + collaborative).
   */
  async getAccessiblePondIds(userId: string): Promise<string[]> {
    const ownedPonds = await this.prisma.pond.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const farmMemberships = await this.prisma.farmMember.findMany({
      where: { memberId: userId },
      select: { ownerId: true },
    });

    const ownerIds = farmMemberships.map((m) => m.ownerId);

    const collaborativePonds =
      ownerIds.length > 0
        ? await this.prisma.pond.findMany({
            where: { ownerId: { in: ownerIds } },
            select: { id: true },
          })
        : [];

    return [...ownedPonds, ...collaborativePonds].map((p) => p.id);
  }

  /**
   * Get all user IDs that have access to a pond (owner + all farm members of the owner).
   */
  async getPondGroupUserIds(pondId: string): Promise<string[]> {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      select: { ownerId: true },
    });

    if (!pond) {
      return [];
    }

    const farmMembers = await this.prisma.farmMember.findMany({
      where: { ownerId: pond.ownerId },
      select: { memberId: true },
    });

    return [pond.ownerId, ...farmMembers.map((m) => m.memberId)];
  }
}
