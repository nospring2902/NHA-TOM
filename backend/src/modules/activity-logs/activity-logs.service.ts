import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(pondId: string, userId: string) {
    await this.assertPondOwnership(pondId, userId);

    const logs = await this.prisma.activityLog.findMany({
      where: {
        pondId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return {
      success: true,
      message: 'Activity logs',
      data: logs.map((item) => ({
        id: item.id,
        pondId: item.pondId,
        action: item.action,
        trigger: item.trigger,
        actorType: item.actorType,
        actorUserId: item.actorUserId,
        metadata: item.metadata,
        createdAt: item.createdAt,
      })),
    };
  }

  private async assertPondOwnership(pondId: string, userId: string) {
    const pond = await this.prisma.pond.findUnique({
      where: {
        id: pondId,
      },
      select: {
        ownerId: true,
      },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao tôm');
    }

    if (pond.ownerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập ao tôm này');
    }
  }
}
