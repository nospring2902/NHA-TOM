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
  }): number {
    const phPenalty = this.rangePenalty(metrics.ph, 7.5, 8.5, 1.0);
    const doPenalty = this.rangePenalty(metrics.dissolvedOxygen, 5.0, 8.0, 1.4);
    const tempPenalty = this.rangePenalty(metrics.temperature, 26, 31, 0.8);
    const salinityPenalty = this.rangePenalty(metrics.salinity, 15, 25, 0.6);

    const score = Math.round(Math.max(0, 100 - phPenalty - doPenalty - tempPenalty - salinityPenalty));
    return score;
  }

  private rangePenalty(
    value: number | null,
    min: number,
    max: number,
    weight: number,
  ): number {
    if (value == null) {
      return 12;
    }

    if (value >= min && value <= max) {
      return 0;
    }

    const distance = value < min ? min - value : value - max;
    return Math.min(25, distance * 10 * weight);
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
