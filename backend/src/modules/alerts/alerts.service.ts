import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PondAccessService } from '../collaboration/pond-access.service';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pondAccessService: PondAccessService,
  ) {}

  async list(pondId: string, userId: string) {
    // Chủ ao và toàn bộ thành viên cộng tác đều được xem cảnh báo của ao.
    await this.pondAccessService.assertReadAccess(pondId, userId);

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
}
