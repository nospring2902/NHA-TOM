import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeviceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AlertNotifierService } from '../alerts/alert-notifier.service';
import { DeviceStatusBroadcaster } from './device-status-broadcaster.service';

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 5 * 1000;

@Injectable()
export class DeviceStatusTask {
  private readonly logger = new Logger(DeviceStatusTask.name);
  private readonly heartbeatTimeoutMs = this.resolveHeartbeatTimeoutMs();

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertNotifierService: AlertNotifierService,
    private readonly deviceStatusBroadcaster: DeviceStatusBroadcaster,
  ) {}

  @Cron('*/10 * * * * *')
  async markStaleOnlineDevicesOffline() {
    const staleBefore = new Date(Date.now() - this.heartbeatTimeoutMs);

    // Lấy trước danh sách thiết bị sắp bị đánh dấu OFFLINE (kèm ao đang gắn) để phát cảnh báo.
    const staleDevices = await this.prisma.device.findMany({
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
      select: {
        id: true,
        serialNumber: true,
        model: true,
        lastTelemetryAt: true,
        pondBindings: {
          where: { unboundAt: null },
          select: { pondId: true },
        },
      },
    });

    if (staleDevices.length === 0) {
      return;
    }

    const result = await this.prisma.device.updateMany({
      where: {
        id: { in: staleDevices.map((device) => device.id) },
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

    for (const device of staleDevices) {
      const deviceLabel = device.model
        ? `${device.model} (${device.serialNumber})`
        : device.serialNumber;

      for (const binding of device.pondBindings) {
        // Đẩy trạng thái OFFLINE tức thì tới mọi người trong nhóm ao.
        await this.deviceStatusBroadcaster.broadcast({
          pondId: binding.pondId,
          deviceId: device.id,
          status: DeviceStatus.OFFLINE,
          lastTelemetryAt: device.lastTelemetryAt,
        });

        await this.alertNotifierService.notifyConnectionLost(binding.pondId, deviceLabel);
      }
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
