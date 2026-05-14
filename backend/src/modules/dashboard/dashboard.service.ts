import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiForecastService } from './ai-forecast.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiForecastService: AiForecastService,
  ) {}

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

  async forecast(pondId: string, userId: string) {
    await this.assertPondOwnership(pondId, userId);

    const lookbackDays = this.getAiLookbackDays();
    const fromDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const dailyRows = await this.prisma.$queryRaw<
      Array<{
        day: Date;
        ph: number | null;
        dissolvedOxygen: number | null;
        temperature: number | null;
        salinity: number | null;
      }>
    >(Prisma.sql`
      SELECT
        date_trunc('day', "tsUtc") AS day,
        avg("ph") AS ph,
        avg("dissolvedOxygen") AS "dissolvedOxygen",
        avg("temperature") AS temperature,
        avg("salinity") AS salinity
      FROM "pond_metric_snapshots"
      WHERE "pondId" = ${pondId}
        AND "tsUtc" >= ${fromDate}
      GROUP BY day
      ORDER BY day ASC
    `);

    const forecast = await this.aiForecastService.predict(dailyRows);

    const horizons = forecast.horizons.map((horizon) => {
      const score = this.calculateWaterScore(horizon.metrics);
      const level = this.resolveScoreLevel(score);
      return {
        day: horizon.day,
        score,
        level,
        metrics: horizon.metrics,
      };
    });

    return {
      success: true,
      message: 'Forecast daily averages',
      data: {
        pondId,
        generatedAt: forecast.generatedAt,
        horizons,
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
      this.buildRangeFactor(metrics.ph, 7.8, 8.2, 7.2, 8.8, 1.0),
      this.buildRangeFactor(metrics.dissolvedOxygen, 5.5, 7.0, 4.6, 8.0, 1.3),
      this.buildRangeFactor(metrics.temperature, 28.0, 30.0, 26.5, 32.0, 1.0),
      this.buildRangeFactor(metrics.salinity, 15.0, 25.0, 10.0, 30.0, 1.0),
    ].filter((factor): factor is { rating: number; weight: number } => factor != null);

    if (factors.length === 0) {
      return null;
    }

    const weightSum = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const ratingSum = factors.reduce((sum, factor) => sum + factor.rating * factor.weight, 0);
    const awqi = ratingSum / weightSum;

    return Math.max(0, Math.min(100, awqi));
  }

  private buildRangeFactor(
    value: number | null,
    idealLow: number,
    idealHigh: number,
    warnLow: number,
    warnHigh: number,
    weight: number,
  ): { rating: number; weight: number } | null {
    if (value == null) {
      return null;
    }

    if (value >= idealLow && value <= idealHigh) {
      return { rating: 0, weight };
    }

    if (value < idealLow) {
      const denominator = idealLow - warnLow;
      if (denominator <= 0) {
        return null;
      }
      const rating = ((idealLow - value) / denominator) * 100;
      return { rating: Math.min(100, Math.max(0, rating)), weight };
    }

    const denominator = warnHigh - idealHigh;
    if (denominator <= 0) {
      return null;
    }
    const rating = ((value - idealHigh) / denominator) * 100;
    return { rating: Math.min(100, Math.max(0, rating)), weight };
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

  private getAiLookbackDays() {
    const raw = process.env.NHATOM_AI_LOOKBACK_DAYS;
    const value = raw ? Number(raw) : 60;
    return Number.isFinite(value) && value > 0 ? value : 60;
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
