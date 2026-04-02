import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GetMetricHistoryDto } from './dto/get-metric-history.dto';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async latest(pondId: string, userId: string) {
    await this.assertPondOwnership(pondId, userId);

    const latest = await this.prisma.pondMetricLatest.findUnique({
      where: {
        pondId,
      },
    });

    if (!latest) {
      return {
        success: true,
        message: 'Chưa có dữ liệu đo mới cho ao này',
        data: {
          pondId,
          measuredAt: null,
          ph: null,
          dissolvedOxygen: null,
          temperature: null,
          salinity: null,
        },
      };
    }

    return {
      success: true,
      message: 'Latest metrics',
      data: {
        pondId,
        measuredAt: latest.updatedAt,
        ph: latest.ph,
        dissolvedOxygen: latest.dissolvedOxygen,
        temperature: latest.temperature,
        salinity: latest.salinity,
      },
    };
  }

  async history(pondId: string, userId: string, query: GetMetricHistoryDto) {
    await this.assertPondOwnership(pondId, userId);

    const toDate = query.to ? new Date(query.to) : new Date();
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);

    const snapshots = await this.prisma.pondMetricSnapshot.findMany({
      where: {
        pondId,
        tsUtc: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: {
        tsUtc: 'asc',
      },
      take: 1000,
    });

    return {
      success: true,
      message: 'Metric history',
      data: {
        pondId,
        query,
        points: snapshots.map((item) => ({
          measuredAt: item.tsUtc,
          ph: item.ph,
          dissolvedOxygen: item.dissolvedOxygen,
          temperature: item.temperature,
          salinity: item.salinity,
          qualityFlag: item.qualityFlag,
        })),
      },
    };
  }

  private async assertPondOwnership(pondId: string, userId: string) {
    const pond = await this.prisma.pond.findUnique({
      where: {
        id: pondId,
      },
      select: {
        id: true,
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
