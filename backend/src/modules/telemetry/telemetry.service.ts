import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DeviceStatus, MetricQualityFlag, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { DeviceTokenCipherService } from '../devices/device-token-cipher.service';
import { AlertNotifierService } from '../alerts/alert-notifier.service';
import { DeviceStatusBroadcaster } from './device-status-broadcaster.service';
import { TelemetryIngestDto } from './dto/telemetry-ingest.dto';
import { TelemetryStatusChangeDto } from './dto/telemetry-status-change.dto';

type NormalizedTelemetryPayload = {
  eventId?: string;
  timestamp?: string;
  deviceId?: string;
  deviceToken?: string;
  serialNumber?: string;
  tbDeviceId?: string;
  thingsboardDeviceId?: string;
  metrics?: {
    ph?: number;
    dissolvedOxygen?: number;
    temperature?: number;
    salinity?: number;
  };
  geo?: {
    lat: number;
    lng: number;
  };
  payload?: Record<string, unknown>;
};

type NormalizedStatusChangePayload = {
  deviceId?: string;
  serialNumber?: string;
  tbDeviceId?: string;
  status?: string;
  active?: boolean;
};

@Injectable()
export class TelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCipherService: DeviceTokenCipherService,
    private readonly alertNotifierService: AlertNotifierService,
    private readonly deviceStatusBroadcaster: DeviceStatusBroadcaster,
  ) {}

  async ingest(payload: TelemetryIngestDto, ingestTokenHeader?: string) {
    this.assertIngestToken(ingestTokenHeader);

    try {
      const normalizedPayload = this.normalizePayload(payload);
      const device = await this.resolveDevice(normalizedPayload);
      const activeBinding = await this.prisma.pondDevice.findFirst({
        where: {
          deviceId: device.id,
          unboundAt: null,
        },
        orderBy: {
          boundAt: 'desc',
        },
      });

      const pondId = activeBinding?.pondId ?? null;
      const receivedAt = new Date();
      const measuredAt = normalizedPayload.timestamp
        ? new Date(normalizedPayload.timestamp)
        : new Date();
      if (Number.isNaN(measuredAt.getTime())) {
        throw new BadRequestException('timestamp không hợp lệ');
      }

      const metrics = normalizedPayload.metrics ?? {};
      const geo = normalizedPayload.geo;
      const eventId = normalizedPayload.eventId?.trim() || this.generateEventId(device.id);

      const ingestResult = await this.prisma.$transaction(async (tx) => {
        if (normalizedPayload.eventId) {
          const existingEvent = await tx.telemetryRaw.findUnique({
            where: {
              eventId,
            },
            select: {
              id: true,
            },
          });

          if (existingEvent) {
            return {
              duplicate: true,
              pondId,
            };
          }
        }

        await tx.device.update({
          where: {
            id: device.id,
          },
          data: {
            status: 'ONLINE',
            isActive: true,
            lastTelemetryAt: receivedAt,
            telemetryPackets: {
              increment: 1,
            },
            tbDeviceId:
              normalizedPayload.tbDeviceId ??
              normalizedPayload.thingsboardDeviceId ??
              device.tbDeviceId,
          },
        });

        if (pondId) {
          await tx.telemetryRaw.create({
            data: {
              eventId,
              pondId,
              deviceId: device.id,
              tsUtc: measuredAt,
              payload: this.toPrismaJsonValue(
                normalizedPayload.payload ?? this.toFallbackPayload(normalizedPayload),
              ),
              source: 'thingsboard',
              ingestStatus: 'accepted',
            },
          });

          await tx.pondMetricSnapshot.create({
            data: {
              pondId,
              deviceId: device.id,
              tsUtc: measuredAt,
              ph: metrics.ph,
              dissolvedOxygen: metrics.dissolvedOxygen,
              temperature: metrics.temperature,
              salinity: metrics.salinity,
              qualityFlag: MetricQualityFlag.VALID,
            },
          });

          await tx.pondMetricLatest.upsert({
            where: {
              pondId,
            },
            create: {
              pondId,
              ph: metrics.ph,
              dissolvedOxygen: metrics.dissolvedOxygen,
              temperature: metrics.temperature,
              salinity: metrics.salinity,
              updatedAt: measuredAt,
            },
            update: {
              ph: metrics.ph,
              dissolvedOxygen: metrics.dissolvedOxygen,
              temperature: metrics.temperature,
              salinity: metrics.salinity,
              updatedAt: measuredAt,
            },
          });

          if (geo) {
            await tx.pond.update({
              where: {
                id: pondId,
              },
              data: {
                latitude: geo.lat,
                longitude: geo.lng,
              },
            });
          }

          await tx.activityLog.create({
            data: {
              pondId,
              actorType: 'system',
              action: 'TELEMETRY_INGESTED',
              trigger: 'thingsboard_webhook',
              metadata: {
                deviceId: device.id,
                eventId,
                geo: geo ?? null,
              },
            },
          });
        } else {
          await tx.activityLog.create({
            data: {
              actorType: 'system',
              action: 'TELEMETRY_RECEIVED_UNBOUND',
              trigger: 'thingsboard_webhook',
              metadata: {
                deviceId: device.id,
                eventId,
              },
            },
          });
        }

        return {
          duplicate: false,
          pondId,
        };
      });

      // Đánh giá ngưỡng và phát cảnh báo (ngoài transaction để không ảnh hưởng ingest).
      if (!ingestResult.duplicate && ingestResult.pondId) {
        // Đẩy trạng thái ONLINE + mốc telemetry mới nhất tới cả nhóm ao để đồng bộ tức thì.
        await this.deviceStatusBroadcaster.broadcast({
          pondId: ingestResult.pondId,
          deviceId: device.id,
          status: DeviceStatus.ONLINE,
          lastTelemetryAt: receivedAt,
        });

        // Thiết bị đang gửi telemetry => đã online trở lại, đóng cảnh báo mất kết nối cũ.
        await this.alertNotifierService.resolveConnectionAlerts(ingestResult.pondId);
        await this.alertNotifierService.evaluateAndNotify(ingestResult.pondId, metrics);
      }

      return {
        success: true,
        message: ingestResult.duplicate
          ? 'Telemetry event đã tồn tại, bỏ qua bản ghi trùng'
          : ingestResult.pondId
            ? 'Telemetry đã được ingest thành công'
            : 'Thiết bị đã gửi telemetry nhưng chưa bind với ao nào',
        data: {
          eventId,
          deviceId: device.id,
          pondId: ingestResult.pondId,
          duplicate: ingestResult.duplicate,
          measuredAt,
          boundToPond: Boolean(ingestResult.pondId),
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Không thể ingest telemetry, vui lòng thử lại');
    }
  }

  async handleStatusChange(payload: TelemetryStatusChangeDto, statusChangeTokenHeader?: string) {
    this.assertStatusChangeToken(statusChangeTokenHeader);

    try {
      const normalizedPayload = this.normalizeStatusChangePayload(payload);
      const device = await this.resolveDeviceForStatusChange(normalizedPayload);
      const status = this.resolveStatusFromStatusChangePayload(normalizedPayload);
      const isActive =
        normalizedPayload.active ??
        (status === DeviceStatus.ONLINE
          ? true
          : status === DeviceStatus.OFFLINE
            ? false
            : device.isActive);

      const updated = await this.prisma.device.update({
        where: {
          id: device.id,
        },
        data: {
          status,
          isActive,
        },
        select: {
          id: true,
          serialNumber: true,
          tbDeviceId: true,
          status: true,
          isActive: true,
          lastTelemetryAt: true,
          updatedAt: true,
        },
      });

      await this.prisma.activityLog.create({
        data: {
          actorType: 'system',
          action: 'DEVICE_STATUS_UPDATED_FROM_WEBHOOK',
          trigger: 'thingsboard_status_change',
          metadata: {
            deviceId: updated.id,
            inputStatus: normalizedPayload.status ?? null,
            inputActive: normalizedPayload.active ?? null,
            resolvedStatus: updated.status,
          },
        },
      });

      // Đẩy trạng thái mới tới nhóm ao đang gắn thiết bị này (nếu có).
      const activeBinding = await this.prisma.pondDevice.findFirst({
        where: { deviceId: updated.id, unboundAt: null },
        orderBy: { boundAt: 'desc' },
        select: { pondId: true },
      });

      if (activeBinding) {
        await this.deviceStatusBroadcaster.broadcast({
          pondId: activeBinding.pondId,
          deviceId: updated.id,
          status: updated.status,
          lastTelemetryAt: updated.lastTelemetryAt,
        });
      }

      return {
        success: true,
        message: 'Đã cập nhật trạng thái thiết bị từ webhook',
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Không thể xử lý webhook đổi trạng thái thiết bị, vui lòng thử lại',
      );
    }
  }

  private assertIngestToken(ingestTokenHeader?: string) {
    const expectedToken = process.env.THINGSBOARD_INGEST_TOKEN;

    if (!expectedToken) {
      return;
    }

    if (!ingestTokenHeader || ingestTokenHeader !== expectedToken) {
      throw new UnauthorizedException('x-ingest-token không hợp lệ');
    }
  }

  private assertStatusChangeToken(statusChangeTokenHeader?: string) {
    const expectedToken =
      process.env.THINGSBOARD_STATUS_CHANGE_TOKEN ?? process.env.THINGSBOARD_INGEST_TOKEN;

    if (!expectedToken) {
      return;
    }

    if (!statusChangeTokenHeader || statusChangeTokenHeader !== expectedToken) {
      throw new UnauthorizedException('x-ingest-token không hợp lệ cho status-change webhook');
    }
  }

  private normalizePayload(payload: TelemetryIngestDto): NormalizedTelemetryPayload {
    const customPayload = this.asRecord(payload.payload);
    const customGeo = this.asRecord(customPayload.geo);
    const customLocation = this.asRecord(customPayload.location);
    const customPosition = this.asRecord(customPayload.position);

    const metrics = {
      // ThingsBoard gửi "pH" (chữ hoa H), cần resolve cả hai dạng
      ph: this.resolveNumber(payload.metrics?.ph, payload.ph, payload.pH, customPayload.ph, customPayload.pH),
      // Thiết bị dùng "turbidity" thay vì "dissolvedOxygen"
      dissolvedOxygen: this.resolveNumber(
        payload.metrics?.dissolvedOxygen,
        payload.metrics?.turbidity,
        payload.dissolvedOxygen,
        payload.dissolved_oxygen,
        payload.turbidity,
        customPayload.dissolvedOxygen,
        customPayload.dissolved_oxygen,
        customPayload.turbidity,
      ),
      temperature: this.resolveNumber(
        payload.metrics?.temperature,
        payload.temperature,
        customPayload.temperature,
      ),
      // Thiết bị dùng "tds" thay vì "salinity"
      salinity: this.resolveNumber(
        payload.metrics?.salinity,
        payload.metrics?.tds,
        payload.salinity,
        payload.tds,
        customPayload.salinity,
        customPayload.tds,
      ),
    };

    const latitude = this.resolveNumber(
      payload.latitude,
      payload.lat,
      payload.geo?.lat,
      customPayload.latitude,
      customPayload.lat,
      customGeo.lat,
      customLocation.lat,
      customPosition.lat,
    );

    const longitude = this.resolveNumber(
      payload.longitude,
      payload.lng,
      payload.lon,
      payload.geo?.lng,
      customPayload.longitude,
      customPayload.lng,
      customPayload.lon,
      customGeo.lng,
      customGeo.lon,
      customLocation.lng,
      customLocation.lon,
      customPosition.lng,
      customPosition.lon,
    );

    const geo = this.resolveGeo(latitude, longitude);

    return {
      eventId: payload.eventId?.trim() || this.resolveString(customPayload.eventId),
      timestamp: payload.timestamp ?? this.resolveString(customPayload.timestamp),
      deviceId: payload.deviceId ?? this.resolveString(customPayload.deviceId),
      deviceToken: payload.deviceToken ?? this.resolveString(customPayload.deviceToken),
      serialNumber: payload.serialNumber ?? this.resolveString(customPayload.serialNumber),
      tbDeviceId: payload.tbDeviceId ?? this.resolveString(customPayload.tbDeviceId),
      thingsboardDeviceId:
        payload.thingsboardDeviceId ?? this.resolveString(customPayload.thingsboardDeviceId),
      metrics,
      geo,
      payload: payload.payload,
    };
  }

  private normalizeStatusChangePayload(
    payload: TelemetryStatusChangeDto,
  ): NormalizedStatusChangePayload {
    const customPayload = this.asRecord(payload.payload);

    return {
      deviceId: payload.deviceId ?? this.resolveString(customPayload.deviceId),
      serialNumber:
        payload.serialNumber ?? this.resolveString(customPayload.serialNumber)?.toUpperCase(),
      tbDeviceId:
        payload.tbDeviceId ??
        payload.thingsboardDeviceId ??
        this.resolveString(customPayload.tbDeviceId) ??
        this.resolveString(customPayload.thingsboardDeviceId),
      status: payload.status ?? this.resolveString(customPayload.status),
      active:
        payload.active ??
        this.resolveBoolean(customPayload.active) ??
        this.resolveBoolean(customPayload.isActive),
    };
  }

  private async resolveDeviceForStatusChange(payload: NormalizedStatusChangePayload) {
    const serializedNumber = payload.serialNumber?.trim().toUpperCase();
    const deviceIdCandidate = payload.deviceId?.trim();
    const tbDeviceIdCandidate = payload.tbDeviceId?.trim();

    const identifiers = [serializedNumber, deviceIdCandidate, tbDeviceIdCandidate].filter(Boolean);
    if (identifiers.length === 0) {
      throw new BadRequestException(
        'Webhook status-change phải có deviceId, tbDeviceId/thingsboardDeviceId hoặc serialNumber',
      );
    }

    const device = await this.prisma.device.findFirst({
      where: {
        OR: [
          deviceIdCandidate ? { id: deviceIdCandidate } : undefined,
          tbDeviceIdCandidate ? { tbDeviceId: tbDeviceIdCandidate } : undefined,
          deviceIdCandidate ? { tbDeviceId: deviceIdCandidate } : undefined,
          serializedNumber ? { serialNumber: serializedNumber } : undefined,
        ].filter((item) => item !== undefined),
      },
      select: {
        id: true,
        serialNumber: true,
        tbDeviceId: true,
        isActive: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Không tìm thấy thiết bị cần cập nhật trạng thái');
    }

    return device;
  }

  private resolveStatusFromStatusChangePayload(payload: NormalizedStatusChangePayload): DeviceStatus {
    const normalizedStatus = payload.status?.trim().toUpperCase();

    if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'ONLINE') {
      return DeviceStatus.ONLINE;
    }

    if (
      normalizedStatus === 'INACTIVE' ||
      normalizedStatus === 'OFFLINE' ||
      normalizedStatus === 'UNPLUGGED'
    ) {
      return DeviceStatus.OFFLINE;
    }

    if (normalizedStatus === 'WAITING_SIGNAL') {
      return DeviceStatus.WAITING_SIGNAL;
    }

    if (normalizedStatus === 'ERROR') {
      return DeviceStatus.ERROR;
    }

    if (normalizedStatus === 'MAINTENANCE') {
      return DeviceStatus.MAINTENANCE;
    }

    if (payload.active === true) {
      return DeviceStatus.ONLINE;
    }

    if (payload.active === false) {
      return DeviceStatus.OFFLINE;
    }

    throw new BadRequestException(
      'Webhook status-change phải gửi status hợp lệ hoặc cờ active (true/false)',
    );
  }

  private toFallbackPayload(payload: NormalizedTelemetryPayload): Record<string, unknown> {
    return {
      eventId: payload.eventId,
      deviceId: payload.deviceId ?? null,
      deviceToken: payload.deviceToken ?? null,
      serialNumber: payload.serialNumber ?? null,
      tbDeviceId: payload.tbDeviceId ?? payload.thingsboardDeviceId ?? null,
      timestamp: payload.timestamp ?? null,
      geo: payload.geo
        ? {
            lat: payload.geo.lat,
            lng: payload.geo.lng,
          }
        : null,
      metrics: payload.metrics
        ? {
            ph: payload.metrics.ph ?? null,
            dissolved_oxygen: payload.metrics.dissolvedOxygen ?? null,
            temperature: payload.metrics.temperature ?? null,
            salinity: payload.metrics.salinity ?? null,
          }
        : null,
    };
  }

  private toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException('payload telemetry phải là JSON hợp lệ');
    }
  }

  private async resolveDevice(payload: NormalizedTelemetryPayload) {
    const deviceToken = payload.deviceToken?.trim();
    const tbDeviceId = payload.tbDeviceId?.trim() ?? payload.thingsboardDeviceId?.trim();

    if (deviceToken) {
      const tokenCandidates = await this.prisma.device.findMany({
        where: {
          accessToken: {
            not: null,
          },
        },
        select: {
          id: true,
          serialNumber: true,
          tbDeviceId: true,
          isActive: true,
          accessToken: true,
        },
      });

      for (const tokenCandidate of tokenCandidates) {
        if (!tokenCandidate.accessToken) {
          continue;
        }

        try {
          const decrypted = this.tokenCipherService.decrypt(tokenCandidate.accessToken);
          if (decrypted === deviceToken) {
            return {
              id: tokenCandidate.id,
              serialNumber: tokenCandidate.serialNumber,
              tbDeviceId: tokenCandidate.tbDeviceId,
              isActive: tokenCandidate.isActive,
            };
          }
        } catch {
          continue;
        }
      }
    }

    const identifiers = [
      payload.deviceId?.trim(),
      payload.serialNumber?.trim().toUpperCase(),
      tbDeviceId,
    ].filter(Boolean);

    if (identifiers.length === 0) {
      throw new BadRequestException(
        'Yêu cầu phải có ít nhất một định danh thiết bị: deviceToken, deviceId, serialNumber hoặc tbDeviceId',
      );
    }

    const device = await this.prisma.device.findFirst({
      where: {
        OR: [
          payload.deviceId ? { id: payload.deviceId.trim() } : undefined,
          payload.serialNumber
            ? { serialNumber: payload.serialNumber.trim().toUpperCase() }
            : undefined,
          tbDeviceId ? { tbDeviceId } : undefined,
        ].filter((item) => item !== undefined),
      },
      select: {
        id: true,
        serialNumber: true,
        tbDeviceId: true,
        isActive: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Không tìm thấy thiết bị cần ingest telemetry');
    }

    return device;
  }

  private resolveString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private resolveBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }

    return undefined;
  }

  private resolveNumber(...candidates: unknown[]): number | undefined {
    for (const candidate of candidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }

      if (typeof candidate === 'string') {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  private resolveGeo(
    latitude: number | undefined,
    longitude: number | undefined,
  ): { lat: number; lng: number } | undefined {
    if (latitude == null || longitude == null) {
      return undefined;
    }

    if (!this.isValidLatitude(latitude) || !this.isValidLongitude(longitude)) {
      return undefined;
    }

    return {
      lat: Number(latitude.toFixed(6)),
      lng: Number(longitude.toFixed(6)),
    };
  }

  private isValidLatitude(value: number): boolean {
    return value >= -90 && value <= 90;
  }

  private isValidLongitude(value: number): boolean {
    return value >= -180 && value <= 180;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private generateEventId(deviceId: string): string {
    return `tb-${deviceId}-${randomUUID()}`;
  }
}
