import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeviceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000;

@Injectable()
export class DeviceStatusTask {
  private readonly logger = new Logger(DeviceStatusTask.name);
  private readonly heartbeatTimeoutMs = this.resolveHeartbeatTimeoutMs();

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async markStaleOnlineDevicesOffline() {
    const staleBefore = new Date(Date.now() - this.heartbeatTimeoutMs);

    const result = await this.prisma.device.updateMany({
      where: {
        status: DeviceStatus.ONLINE,
        OR: [
          {
            lastTelemetryAt: {
              lt: staleBefore,
            },
          },
          {
            lastTelemetryAt: null,
          },
        ],
      },
      data: {
        status: DeviceStatus.OFFLINE,
        isActive: false,
      },
    });

    if (result.count > 0) {
      this.logger.warn(
        `Heartbeat timeout: moved ${result.count} device(s) to OFFLINE (threshold=${this.heartbeatTimeoutMs}ms)`,
      );
    }
  }

  private resolveHeartbeatTimeoutMs(): number {
    const raw = Number(process.env.DEVICE_HEARTBEAT_TIMEOUT_MS);

    if (!Number.isFinite(raw) || raw <= 0) {
      return DEFAULT_HEARTBEAT_TIMEOUT_MS;
    }

    return raw;
  }
}
