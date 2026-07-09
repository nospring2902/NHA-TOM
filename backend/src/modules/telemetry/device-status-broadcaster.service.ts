import { Injectable, Logger } from '@nestjs/common';
import { PondAccessService } from '../collaboration/pond-access.service';
import { RealtimeService } from '../friends/realtime.service';

export type DeviceStatusEvent = {
  pondId: string;
  deviceId: string;
  status: string;
  lastTelemetryAt: Date | string | null;
  telemetryPackets?: number;
};

@Injectable()
export class DeviceStatusBroadcaster {
  private readonly logger = new Logger(DeviceStatusBroadcaster.name);

  constructor(
    private readonly pondAccessService: PondAccessService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Đẩy trạng thái thiết bị tới toàn bộ nhóm ao (chủ ao + thành viên) qua WebSocket,
   * giúp giao diện cập nhật tức thì và đồng bộ giữa mọi người mà không cần polling dày.
   */
  async broadcast(event: DeviceStatusEvent): Promise<void> {
    try {
      const userIds = await this.pondAccessService.getPondGroupUserIds(event.pondId);
      if (userIds.length === 0) {
        return;
      }

      this.realtimeService.emitToUsers(userIds, 'device:status', {
        pondId: event.pondId,
        deviceId: event.deviceId,
        status: event.status,
        lastTelemetryAt: event.lastTelemetryAt,
        telemetryPackets: event.telemetryPackets,
      });
    } catch (error) {
      this.logger.error(
        `Không thể phát trạng thái thiết bị cho ao ${event.pondId}`,
        error as Error,
      );
    }
  }
}
