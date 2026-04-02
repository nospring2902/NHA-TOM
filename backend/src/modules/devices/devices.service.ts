import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDeviceCommandDto } from './dto/create-device-command.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async start(deviceId: string, userId: string) {
    try {
      const { pondId } = await this.assertDeviceOwned(deviceId, userId);

      const device = await this.prisma.device.update({
        where: { id: deviceId },
        data: { isActive: true },
        select: {
          id: true,
          serialNumber: true,
          isActive: true,
          status: true,
          updatedAt: true,
        },
      });

      await this.prisma.activityLog.create({
        data: {
          pondId,
          actorUserId: userId,
          actorType: 'user',
          action: 'DEVICE_STARTED',
          trigger: 'manual',
          metadata: {
            deviceId,
          },
        },
      });

      return {
        success: true,
        message: 'Thiết bị đã được bật (ACTIVE)',
        data: device,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Không thể bật thiết bị, vui lòng thử lại');
    }
  }

  async stop(deviceId: string, userId: string) {
    try {
      const { pondId } = await this.assertDeviceOwned(deviceId, userId);

      const device = await this.prisma.device.update({
        where: { id: deviceId },
        data: { isActive: false },
        select: {
          id: true,
          serialNumber: true,
          isActive: true,
          status: true,
          updatedAt: true,
        },
      });

      await this.prisma.activityLog.create({
        data: {
          pondId,
          actorUserId: userId,
          actorType: 'user',
          action: 'DEVICE_STOPPED',
          trigger: 'manual',
          metadata: {
            deviceId,
          },
        },
      });

      return {
        success: true,
        message: 'Thiết bị đã được tắt (INACTIVE)',
        data: device,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Không thể tắt thiết bị, vui lòng thử lại');
    }
  }

  async list(pondId: string, userId: string) {
    await this.assertPondOwnership(pondId, userId);

    const bindings = await this.prisma.pondDevice.findMany({
      where: {
        pondId,
        unboundAt: null,
      },
      include: {
        device: true,
      },
      orderBy: {
        boundAt: 'desc',
      },
    });

    const data = await Promise.all(
      bindings.map(async (binding) => {
        const latestCommand = await this.prisma.deviceCommand.findFirst({
          where: {
            deviceId: binding.device.id,
          },
          orderBy: {
            queuedAt: 'desc',
          },
          select: {
            action: true,
          },
        });

        const isOn = latestCommand
          ? latestCommand.action === 'turn_on'
          : binding.device.status === 'ONLINE';
        const mode = latestCommand?.action === 'set_manual' ? 'manual' : 'auto';

        return {
          id: binding.device.id,
          pondId,
          serialNumber: binding.device.serialNumber,
          type: binding.device.type.toLowerCase(),
          status: binding.device.status,
          mode,
          isOn,
          lastTelemetryAt: binding.device.lastTelemetryAt,
          telemetryPackets: binding.device.telemetryPackets,
        };
      }),
    );

    return {
      success: true,
      message: 'Device list',
      data,
    };
  }

  async command(
    pondId: string,
    deviceId: string,
    payload: CreateDeviceCommandDto,
    userId: string,
  ) {
    await this.assertPondOwnership(pondId, userId);

    const binding = await this.prisma.pondDevice.findFirst({
      where: {
        pondId,
        deviceId,
        unboundAt: null,
      },
    });

    if (!binding) {
      throw new NotFoundException('Không tìm thấy thiết bị trong ao tôm');
    }

    const command = await this.prisma.deviceCommand.create({
      data: {
        pondId,
        deviceId,
        action: payload.action,
        reason: payload.reason,
        requestedByUserId: userId,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        pondId,
        actorUserId: userId,
        actorType: 'user',
        action: 'DEVICE_COMMAND_CREATED',
        trigger: 'manual',
        metadata: {
          commandId: command.id,
          deviceId,
          action: payload.action,
        },
      },
    });

    return {
      success: true,
      message: 'Device command queued',
      data: {
        id: command.id,
        pondId: command.pondId,
        deviceId: command.deviceId,
        action: command.action,
        reason: command.reason,
        queuedAt: command.queuedAt,
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

  private async assertDeviceOwned(deviceId: string, userId: string) {
    const deviceExists = await this.prisma.device.findUnique({
      where: {
        id: deviceId,
      },
      select: {
        id: true,
      },
    });

    if (!deviceExists) {
      throw new NotFoundException('Không tìm thấy thiết bị');
    }

    const binding = await this.prisma.pondDevice.findFirst({
      where: {
        deviceId,
        unboundAt: null,
      },
      orderBy: {
        boundAt: 'desc',
      },
      select: {
        pondId: true,
      },
    });

    if (!binding) {
      throw new BadRequestException('Thiết bị chưa được bind với ao nào');
    }

    await this.assertPondOwnership(binding.pondId, userId);
    return { pondId: binding.pondId };
  }
}
