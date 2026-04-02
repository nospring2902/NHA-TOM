import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(pondId: string, userId: string) {
    await this.assertPondOwnership(pondId, userId);

    const alerts = await this.prisma.alert.findMany({
      where: {
        pondId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return {
      success: true,
      message: 'Alerts list',
      data: alerts.map((alert) => ({
        id: alert.id,
        pondId: alert.pondId,
        severity: alert.severity.toLowerCase(),
        status: alert.status.toLowerCase(),
        metricKey: alert.metricKey,
        message: alert.message,
        predictedFor: alert.predictedFor,
        createdAt: alert.createdAt,
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
