import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async realtime(pondId: string, userId: string) {
    await this.assertPondOwnership(pondId, userId);

    const [latest, snapshots, activeBindings] = await Promise.all([
      this.prisma.pondMetricLatest.findUnique({
        where: {
          pondId,
        },
      }),
      this.prisma.pondMetricSnapshot.findMany({
        where: {
          pondId,
        },
        orderBy: {
          tsUtc: 'desc',
        },
        take: 72,
        select: {
          tsUtc: true,
          ph: true,
          dissolvedOxygen: true,
          temperature: true,
          salinity: true,
        },
      }),
      this.prisma.pondDevice.findMany({
        where: {
          pondId,
          unboundAt: null,
        },
        orderBy: {
          boundAt: 'desc',
        },
        select: {
          boundAt: true,
          device: {
            select: {
              id: true,
              serialNumber: true,
              model: true,
              type: true,
              status: true,
              isActive: true,
              telemetryPackets: true,
              lastTelemetryAt: true,
            },
          },
        },
      }),
    ]);

    const score = latest ? this.calculateWaterScore(latest) : null;
    const level = this.resolveScoreLevel(score);

    const history = snapshots
      .slice()
      .reverse()
      .map((snapshot) => ({
        measuredAt: snapshot.tsUtc,
        ph: snapshot.ph,
        dissolvedOxygen: snapshot.dissolvedOxygen,
        temperature: snapshot.temperature,
        salinity: snapshot.salinity,
      }));

    const devices = activeBindings.map(({ device, boundAt }) => {
      const heartbeatOnline = this.isDeviceOnlineByHeartbeat(device.lastTelemetryAt);
      const realtimeStatus = heartbeatOnline
        ? 'ONLINE'
        : device.lastTelemetryAt
          ? 'OFFLINE'
          : 'WAITING_SIGNAL';

      return {
        id: device.id,
        serialNumber: device.serialNumber,
        model: device.model,
        type: device.type,
        status: realtimeStatus,
        lastTelemetryAt: device.lastTelemetryAt,
        telemetryPackets: device.telemetryPackets,
        isActive: device.isActive,
        boundAt,
      };
    });

    return {
      success: true,
      message: 'Realtime dashboard data',
      data: {
        pondId,
        score,
        level,
        latestMetric: latest
          ? {
              measuredAt: latest.updatedAt,
              ph: latest.ph,
              dissolvedOxygen: latest.dissolvedOxygen,
              temperature: latest.temperature,
              salinity: latest.salinity,
            }
          : null,
        metricsHistory: history,
        devices,
      },
    };
  }

  async score(pondId: string, userId: string) {
    await this.assertPondOwnership(pondId, userId);

    const latest = await this.prisma.pondMetricLatest.findUnique({
      where: {
        pondId,
      },
    });

    if (!latest) {
      return {
        success: true,
        message: 'Chưa đủ dữ liệu để tính chỉ số chất lượng nước',
        data: {
          pondId,
          score: null,
          level: 'unknown',
          measuredAt: null,
        },
      };
    }

    const score = this.calculateWaterScore(latest);

    if (score == null) {
      return {
        success: true,
        message: 'Chưa đủ dữ liệu để tính chỉ số chất lượng nước',
        data: {
          pondId,
          score: null,
          level: 'unknown',
          measuredAt: latest.updatedAt,
        },
      };
    }

    return {
      success: true,
      message: 'Water score',
      data: {
        pondId,
        score,
        level: score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
        measuredAt: latest.updatedAt,
      },
    };
  }

  private calculateWaterScore(metrics: {
    ph: number | null;
    dissolvedOxygen: number | null;
    temperature: number | null;
    salinity: number | null;
  }): number | null {
    const awqi = this.calculateAwqi(metrics);

    if (awqi == null) {
      return null;
    }

    const score = Math.round(Math.max(0, Math.min(100, 100 - awqi)));
    return score;
  }

  private calculateAwqi(metrics: {
    ph: number | null;
    dissolvedOxygen: number | null;
    temperature: number | null;
    salinity: number | null;
  }): number | null {
    const factors = [
      this.buildAwqiFactor(metrics.ph, 8.0, 8.5, 1 / 8.5, true),
      this.buildAwqiFactor(metrics.dissolvedOxygen, 14.6, 5.0, 1 / 5.0, false),
      this.buildAwqiFactor(metrics.temperature, 28.5, 31.0, 1 / 31.0, true),
      this.buildAwqiFactor(metrics.salinity, 20.0, 25.0, 1 / 25.0, true),
    ].filter((factor): factor is { rating: number; weight: number } => factor != null);

    if (factors.length === 0) {
      return null;
    }

    const weightSum = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const ratingSum = factors.reduce((sum, factor) => sum + factor.rating * factor.weight, 0);
    const awqi = ratingSum / weightSum;

    return Math.max(0, Math.min(100, awqi));
  }

  private buildAwqiFactor(
    value: number | null,
    ideal: number,
    standard: number,
    weight: number,
    useAbsolute: boolean,
  ): { rating: number; weight: number } | null {
    if (value == null) {
      return null;
    }

    const denominator = standard - ideal;
    if (denominator === 0) {
      return null;
    }

    const numerator = useAbsolute ? Math.abs(value - ideal) : value - ideal;
    const rating = Math.max(0, (numerator / denominator) * 100);

    return {
      rating,
      weight,
    };
  }

  private resolveScoreLevel(score: number | null) {
    if (score == null) {
      return 'unknown';
    }

    if (score >= 85) {
      return 'excellent';
    }

    if (score >= 70) {
      return 'good';
    }

    if (score >= 50) {
      return 'fair';
    }

    return 'poor';
  }

  private isDeviceOnlineByHeartbeat(lastTelemetryAt: Date | null): boolean {
    if (!lastTelemetryAt) {
      return false;
    }

    return Date.now() - lastTelemetryAt.getTime() <= 2 * 60 * 1000;
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
