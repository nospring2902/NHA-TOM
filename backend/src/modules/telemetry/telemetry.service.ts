import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MetricQualityFlag, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TelemetryIngestDto } from './dto/telemetry-ingest.dto';

@Injectable()
export class TelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(payload: TelemetryIngestDto, ingestTokenHeader?: string) {
    this.assertIngestToken(ingestTokenHeader);

    try {
      const device = await this.resolveDevice(payload);
      const activeBinding = await this.prisma.pondDevice.findFirst({
        where: {
          deviceId: device.id,
          unboundAt: null,
        },
        orderBy: {
          boundAt: 'desc',
        },
      });

      if (!activeBinding) {
        throw new BadRequestException('Thiết bị chưa được bind với ao nào');
      }

      if (!device.isActive) {
        throw new BadRequestException(
          'Thiết bị chưa được bật (ACTIVE). Không cho phép ingest telemetry để tránh rác DB.',
        );
      }

      const pondId = activeBinding.pondId;
      const measuredAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
      if (Number.isNaN(measuredAt.getTime())) {
        throw new BadRequestException('timestamp không hợp lệ');
      }

      const metrics = payload.metrics ?? {};

      const ingestResult = await this.prisma.$transaction(async (tx) => {
        const existingEvent = await tx.telemetryRaw.findUnique({
          where: {
            eventId: payload.eventId,
          },
          select: {
            id: true,
          },
        });

        if (existingEvent) {
          return {
            duplicate: true,
          };
        }

        await tx.telemetryRaw.create({
          data: {
            eventId: payload.eventId,
            pondId,
            deviceId: device.id,
            tsUtc: measuredAt,
            payload: this.toPrismaJsonValue(payload.payload ?? this.toFallbackPayload(payload)),
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

        await tx.device.update({
          where: {
            id: device.id,
          },
          data: {
            status: 'ONLINE',
            lastTelemetryAt: measuredAt,
            telemetryPackets: {
              increment: 1,
            },
            thingsboardDeviceId: payload.thingsboardDeviceId ?? device.thingsboardDeviceId,
          },
        });

        await tx.activityLog.create({
          data: {
            pondId,
            actorType: 'system',
            action: 'TELEMETRY_INGESTED',
            trigger: 'thingsboard_webhook',
            metadata: {
              deviceId: device.id,
              eventId: payload.eventId,
            },
          },
        });

        return {
          duplicate: false,
        };
      });

      return {
        success: true,
        message: ingestResult.duplicate
          ? 'Telemetry event đã tồn tại, bỏ qua bản ghi trùng'
          : 'Telemetry đã được ingest thành công',
        data: {
          eventId: payload.eventId,
          deviceId: device.id,
          pondId,
          duplicate: ingestResult.duplicate,
          measuredAt,
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

  private assertIngestToken(ingestTokenHeader?: string) {
    const expectedToken = process.env.THINGSBOARD_INGEST_TOKEN;

    if (!expectedToken) {
      return;
    }

    if (!ingestTokenHeader || ingestTokenHeader !== expectedToken) {
      throw new UnauthorizedException('x-ingest-token không hợp lệ');
    }
  }

  private toFallbackPayload(payload: TelemetryIngestDto): Record<string, unknown> {
    return {
      eventId: payload.eventId,
      deviceId: payload.deviceId ?? null,
      serialNumber: payload.serialNumber ?? null,
      thingsboardDeviceId: payload.thingsboardDeviceId ?? null,
      timestamp: payload.timestamp ?? null,
      metrics: payload.metrics ?? null,
    };
  }

  private toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException('payload telemetry phải là JSON hợp lệ');
    }
  }

  private async resolveDevice(payload: TelemetryIngestDto) {
    const identifiers = [
      payload.deviceId?.trim(),
      payload.serialNumber?.trim().toUpperCase(),
      payload.thingsboardDeviceId?.trim(),
    ].filter(Boolean);

    if (identifiers.length === 0) {
      throw new BadRequestException(
        'Yêu cầu phải có ít nhất một định danh thiết bị: deviceId, serialNumber hoặc thingsboardDeviceId',
      );
    }

    const device = await this.prisma.device.findFirst({
      where: {
        OR: [
          payload.deviceId ? { id: payload.deviceId.trim() } : undefined,
          payload.serialNumber
            ? { serialNumber: payload.serialNumber.trim().toUpperCase() }
            : undefined,
          payload.thingsboardDeviceId
            ? { thingsboardDeviceId: payload.thingsboardDeviceId.trim() }
            : undefined,
        ].filter((item) => item !== undefined),
      },
      select: {
        id: true,
        serialNumber: true,
        thingsboardDeviceId: true,
        isActive: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Không tìm thấy thiết bị cần ingest telemetry');
    }

    return device;
  }
}
