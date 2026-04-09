import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeviceStatus,
  DeviceType,
  InventoryStatus,
  PondWaterType as PrismaPondWaterType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BindDeviceDto } from './dto/bind-device.dto';
import {
  CreatePondDto,
  PondWaterType as CreatePondWaterType,
} from './dto/create-pond.dto';
import { UpdatePondDto } from './dto/update-pond.dto';

const WATER_TYPE_TO_PRISMA: Record<CreatePondWaterType, PrismaPondWaterType> = {
  [CreatePondWaterType.FRESHWATER]: 'FRESH',
  [CreatePondWaterType.BRACKISH]: 'BRACKISH',
  [CreatePondWaterType.MARINE]: 'SALINE',
};

const WATER_TYPE_FROM_PRISMA: Record<PrismaPondWaterType, CreatePondWaterType> = {
  FRESH: CreatePondWaterType.FRESHWATER,
  BRACKISH: CreatePondWaterType.BRACKISH,
  SALINE: CreatePondWaterType.MARINE,
};

const DEVICE_TYPE_FROM_PRISMA: Record<DeviceType, string> = {
  SENSOR_GATEWAY: 'sensor_gateway',
  AERATOR: 'aerator',
  PUMP: 'pump',
  LIGHT: 'light',
  FEEDER: 'feeder',
};

@Injectable()
export class PondsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const ponds = await this.prisma.pond.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      message: 'List ponds',
      data: ponds.map((pond) => this.serializePond(pond)),
      meta: {
        page: 1,
        limit: 20,
        total: ponds.length,
      },
    };
  }

  async getById(id: string, userId: string) {
    const pond = await this.findOwnedPondOrThrow(id, userId);

    return {
      success: true,
      message: 'Get pond detail',
      data: this.serializePond(pond),
    };
  }

  async create(userId: string, payload: CreatePondDto) {
    const createdPond = await this.prisma.pond.create({
      data: {
        ownerId: userId,
        name: payload.name.trim(),
        farmName: payload.farmName.trim(),
        province: payload.province.trim(),
        district: payload.district.trim(),
        ward: payload.ward.trim(),
        areaM2: payload.areaM2,
        averageDepthM: payload.averageDepthM,
        waterType: WATER_TYPE_TO_PRISMA[payload.waterType],
        timezone: payload.timezone?.trim() || 'Asia/Ho_Chi_Minh',
      },
    });

    await this.prisma.activityLog.create({
      data: {
        pondId: createdPond.id,
        actorUserId: userId,
        actorType: 'user',
        action: 'POND_CREATED',
        trigger: 'manual',
      },
    });

    return {
      success: true,
      message: 'Create pond successfully',
      data: {
        ...this.serializePond(createdPond),
        lifecycleStatus: 'provisioning',
        provisioning: {
          step: 'device_binding',
          requiredTelemetryWindowMinutes: 30,
          minimumSensorPackets: 10,
        },
      },
    };
  }

  async update(id: string, userId: string, payload: UpdatePondDto) {
    await this.findOwnedPondOrThrow(id, userId);

    const updatedPond = await this.prisma.pond.update({
      where: { id },
      data: {
        name: payload.name?.trim(),
        province: payload.province?.trim(),
        district: payload.district?.trim(),
        ward: payload.ward?.trim(),
        areaM2: payload.areaM2,
        averageDepthM: payload.averageDepthM,
        waterType: payload.waterType ? WATER_TYPE_TO_PRISMA[payload.waterType] : undefined,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        pondId: id,
        actorUserId: userId,
        actorType: 'user',
        action: 'POND_UPDATED',
        trigger: 'manual',
      },
    });

    return {
      success: true,
      message: 'Update pond successfully',
      data: this.serializePond(updatedPond),
    };
  }

  async remove(id: string, userId: string) {
    await this.findOwnedPondOrThrow(id, userId);

    await this.prisma.pond.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Delete pond successfully',
      data: {
        id,
        deleted: true,
      },
    };
  }

  async bindDevice(pondId: string, userId: string, payload: BindDeviceDto) {
    await this.findOwnedPondOrThrow(pondId, userId);

    const serialNumber = payload.serialNumber.toUpperCase();

    const provisionedDevice = await this.prisma.device.findUnique({
      where: {
        serialNumber,
      },
      select: {
        id: true,
        serialNumber: true,
        model: true,
        type: true,
        status: true,
        telemetryPackets: true,
        lastTelemetryAt: true,
        ownerId: true,
        createdAt: true,
      },
    });

    if (provisionedDevice) {
      const boundDevice = await this.prisma.$transaction(async (tx) => {
        const activeBinding = await tx.pondDevice.findFirst({
          where: {
            deviceId: provisionedDevice.id,
            unboundAt: null,
          },
          select: {
            id: true,
          },
        });

        if (activeBinding) {
          throw new ConflictException('Mã này đã được sử dụng');
        }

        if (provisionedDevice.ownerId && provisionedDevice.ownerId !== userId) {
          throw new ConflictException('Mã này đã được sử dụng');
        }

        const activeBindingCount = await tx.pondDevice.count({
          where: {
            pondId,
            unboundAt: null,
          },
        });

        const updatedDevice = await tx.device.update({
          where: {
            id: provisionedDevice.id,
          },
          data: {
            ownerId: userId,
            status: DeviceStatus.WAITING_SIGNAL,
          },
        });

        const binding = await tx.pondDevice.create({
          data: {
            pondId,
            deviceId: updatedDevice.id,
            isPrimary: activeBindingCount === 0,
          },
        });

        await tx.activityLog.create({
          data: {
            pondId,
            actorUserId: userId,
            actorType: 'user',
            action: 'DEVICE_BOUND',
            trigger: 'manual',
            metadata: {
              serialNumber,
              deviceId: updatedDevice.id,
            },
          },
        });

        return {
          device: updatedDevice,
          boundAt: binding.boundAt,
        };
      });

      return {
        success: true,
        message: 'Kết nối thiết bị thành công, đang chờ tín hiệu đầu tiên',
        data: {
          id: boundDevice.device.id,
          pondId,
          serialNumber: boundDevice.device.serialNumber,
          model: boundDevice.device.model,
          type: DEVICE_TYPE_FROM_PRISMA[boundDevice.device.type],
          status: boundDevice.device.status,
          telemetryPackets: boundDevice.device.telemetryPackets,
          boundAt: boundDevice.boundAt,
          lastTelemetryAt: boundDevice.device.lastTelemetryAt,
        },
      };
    }

    await this.seedInventoryIfEmpty();

    const inventoryRecord = await this.prisma.deviceInventory.findUnique({
      where: {
        serialNumber,
      },
    });

    if (!inventoryRecord) {
      throw new BadRequestException('Mã thiết bị không hợp lệ');
    }

    if (inventoryRecord.status !== InventoryStatus.AVAILABLE) {
      throw new ConflictException('Mã này đã được sử dụng');
    }

    const createdDevice = await this.prisma.$transaction(async (tx) => {
      const existingDevice = await tx.device.findUnique({
        where: {
          serialNumber,
        },
        select: {
          id: true,
        },
      });

      if (existingDevice) {
        throw new ConflictException('Mã này đã được sử dụng');
      }

      const activeBindingCount = await tx.pondDevice.count({
        where: {
          pondId,
          unboundAt: null,
        },
      });

      const device = await tx.device.create({
        data: {
          serialNumber,
          ownerId: userId,
          model: inventoryRecord.model,
          type: inventoryRecord.type,
          status: DeviceStatus.WAITING_SIGNAL,
          telemetryPackets: 0,
        },
      });

      await tx.pondDevice.create({
        data: {
          pondId,
          deviceId: device.id,
          isPrimary: activeBindingCount === 0,
        },
      });

      await tx.deviceInventory.update({
        where: {
          serialNumber,
        },
        data: {
          status: InventoryStatus.ACTIVATED,
          activatedAt: new Date(),
          activatedByUserId: userId,
          activatedPondId: pondId,
        },
      });

      await tx.activityLog.create({
        data: {
          pondId,
          actorUserId: userId,
          actorType: 'user',
          action: 'DEVICE_BOUND',
          trigger: 'manual',
          metadata: {
            serialNumber,
            deviceId: device.id,
          },
        },
      });

      return device;
    });

    return {
      success: true,
      message: 'Kết nối thiết bị thành công, đang chờ tín hiệu đầu tiên',
      data: {
        id: createdDevice.id,
        pondId,
        serialNumber: createdDevice.serialNumber,
        model: createdDevice.model,
        type: DEVICE_TYPE_FROM_PRISMA[createdDevice.type],
        status: createdDevice.status,
        telemetryPackets: createdDevice.telemetryPackets,
        boundAt: createdDevice.createdAt,
        lastTelemetryAt: createdDevice.lastTelemetryAt,
      },
    };
  }

  async getTelemetryStatus(pondId: string, deviceId: string, userId: string) {
    await this.findOwnedPondOrThrow(pondId, userId);

    const pondDevice = await this.prisma.pondDevice.findFirst({
      where: {
        pondId,
        deviceId,
        unboundAt: null,
      },
      include: {
        device: true,
      },
    });

    if (!pondDevice) {
      throw new NotFoundException('Không tìm thấy thiết bị trong ao tôm');
    }

    const { device } = pondDevice;
    const hasTelemetry = Boolean(device.lastTelemetryAt);
    const lastTelemetryAgeMs = device.lastTelemetryAt
      ? Date.now() - device.lastTelemetryAt.getTime()
      : Number.POSITIVE_INFINITY;
    const isOnline = lastTelemetryAgeMs <= 2 * 60 * 1000;
    const status = isOnline
      ? DeviceStatus.ONLINE
      : hasTelemetry
        ? DeviceStatus.OFFLINE
        : DeviceStatus.WAITING_SIGNAL;

    return {
      success: true,
      message: isOnline
        ? 'Thiết bị đã gửi telemetry và đang trực tuyến'
        : hasTelemetry
          ? 'Thiết bị đã mất tín hiệu (quá 2 phút không nhận telemetry mới)'
          : 'Đang đợi tín hiệu từ thiết bị...',
      data: {
        deviceId: device.id,
        serialNumber: device.serialNumber,
        status,
        isOnline,
        telemetryPackets: device.telemetryPackets,
        lastTelemetryAt: device.lastTelemetryAt,
      },
    };
  }

  private async findOwnedPondOrThrow(pondId: string, userId: string) {
    const pond = await this.prisma.pond.findUnique({
      where: {
        id: pondId,
      },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao tôm');
    }

    if (pond.ownerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên ao tôm này');
    }

    return pond;
  }

  private serializePond(pond: {
    id: string;
    ownerId: string;
    name: string;
    farmName: string;
    province: string;
    district: string;
    ward: string;
    areaM2: number;
    averageDepthM: number;
    waterType: PrismaPondWaterType;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: pond.id,
      ownerId: pond.ownerId,
      name: pond.name,
      farmName: pond.farmName,
      province: pond.province,
      district: pond.district,
      ward: pond.ward,
      location: `${pond.ward}, ${pond.district}, ${pond.province}`,
      areaM2: pond.areaM2,
      averageDepthM: pond.averageDepthM,
      waterType: WATER_TYPE_FROM_PRISMA[pond.waterType],
      timezone: pond.timezone,
      createdAt: pond.createdAt,
      updatedAt: pond.updatedAt,
    };
  }

  private async seedInventoryIfEmpty() {
    const inventoryCount = await this.prisma.deviceInventory.count();
    if (inventoryCount > 0) {
      return;
    }

    await this.prisma.deviceInventory.createMany({
      data: [
        {
          serialNumber: 'AS-2026-0001',
          model: 'AquaShrimp Sensor Hub V2',
          type: DeviceType.SENSOR_GATEWAY,
          status: InventoryStatus.AVAILABLE,
        },
        {
          serialNumber: 'AS-2026-0002',
          model: 'AquaShrimp Sensor Hub V2',
          type: DeviceType.SENSOR_GATEWAY,
          status: InventoryStatus.AVAILABLE,
        },
      ],
      skipDuplicates: true,
    });
  }
}
