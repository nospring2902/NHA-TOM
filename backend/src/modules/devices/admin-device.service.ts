import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeviceStatus, DeviceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DeviceTokenCipherService } from './device-token-cipher.service';
import { ThingsboardService } from './thingsboard.service';

@Injectable()
export class AdminDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thingsboardService: ThingsboardService,
    private readonly tokenCipherService: DeviceTokenCipherService,
  ) {}

  async provision(serialNumber: string, adminUserId: string) {
    const normalizedSerial = serialNumber.trim().toUpperCase();

    const existing = await this.prisma.device.findUnique({
      where: {
        serialNumber: normalizedSerial,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('Serial này đã tồn tại trong hệ thống cục bộ');
    }

    const tbDeviceId = await this.thingsboardService.createDevice(normalizedSerial);
    const accessToken = await this.thingsboardService.getDeviceCredentials(tbDeviceId);
    const encryptedAccessToken = this.tokenCipherService.encrypt(accessToken);

    try {
      const created = await this.prisma.device.create({
        data: {
          serialNumber: normalizedSerial,
          model: 'AquaShrimp Sensor Hub V2',
          type: DeviceType.SENSOR_GATEWAY,
          status: DeviceStatus.INACTIVE,
          isActive: false,
          ownerId: null,
          tbDeviceId,
          accessToken: encryptedAccessToken,
        },
        select: {
          id: true,
          serialNumber: true,
          tbDeviceId: true,
          status: true,
          ownerId: true,
          createdAt: true,
        },
      });

      await this.prisma.activityLog.create({
        data: {
          actorUserId: adminUserId,
          actorType: 'admin',
          action: 'DEVICE_PROVISIONED',
          trigger: 'manual',
          metadata: {
            deviceId: created.id,
            serialNumber: created.serialNumber,
            tbDeviceId,
          },
        },
      });

      return {
        success: true,
        message: 'Provision thiết bị thành công',
        data: {
          id: created.id,
          serialNumber: created.serialNumber,
          tbDeviceId: created.tbDeviceId,
          status: created.status,
          ownerId: created.ownerId,
          owner: null,
          accessToken,
          accessTokenMasked: this.tokenCipherService.maskToken(accessToken),
          hasOwner: false,
          createdAt: created.createdAt,
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Thiết bị bị trùng dữ liệu định danh (serialNumber, tbDeviceId hoặc accessToken)',
        );
      }

      throw new InternalServerErrorException('Không thể lưu thiết bị đã provision vào cơ sở dữ liệu');
    }
  }

  async listAllDevices() {
    const devices = await this.prisma.device.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        serialNumber: true,
        tbDeviceId: true,
        status: true,
        ownerId: true,
        accessToken: true,
        isActive: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Danh sách thiết bị trong kho',
      data: devices.map((device) => ({
        id: device.id,
        serialNumber: device.serialNumber,
        tbDeviceId: device.tbDeviceId,
        status: device.status,
        isActive: device.isActive,
        ownerId: device.ownerId,
        owner: device.owner,
        hasOwner: Boolean(device.ownerId),
        accessTokenMasked: device.accessToken ? '***' : null,
        createdAt: device.createdAt,
      })),
    };
  }

  async getAccessToken(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: {
        id: deviceId,
      },
      select: {
        id: true,
        serialNumber: true,
        accessToken: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Không tìm thấy thiết bị');
    }

    if (!device.accessToken) {
      throw new NotFoundException('Thiết bị chưa có access token');
    }

    const decryptedToken = this.tokenCipherService.decrypt(device.accessToken);

    return {
      success: true,
      message: 'Lấy access token thành công',
      data: {
        id: device.id,
        serialNumber: device.serialNumber,
        accessToken: decryptedToken,
        accessTokenMasked: this.tokenCipherService.maskToken(decryptedToken),
      },
    };
  }
}
