import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { createUserPasswordHash } from '../../utils/password.util';

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const adminEmail = 'nhatom@gmail.com';
    const adminFullName = 'admin';
    const adminPassword = '123456789';
    const adminPhone = process.env.ADMIN_BOOTSTRAP_PHONE?.trim();
    const now = new Date();

    await this.prisma.user.updateMany({
      where: {
        role: 'ADMIN',
        email: {
          not: adminEmail,
        },
      },
      data: {
        role: 'FARM_STAFF',
      },
    });

    await this.prisma.user.upsert({
      where: {
        email: adminEmail,
      },
      create: {
        email: adminEmail,
        fullName: adminFullName,
        passwordHash: createUserPasswordHash(adminPassword),
        role: 'ADMIN',
        phone: adminPhone || null,
        emailVerifiedAt: now,
        phoneVerifiedAt: adminPhone ? now : null,
      },
      update: {
        fullName: adminFullName,
        passwordHash: createUserPasswordHash(adminPassword),
        role: 'ADMIN',
        emailVerifiedAt: now,
        ...(adminPhone
          ? {
              phone: adminPhone,
              phoneVerifiedAt: now,
            }
          : {}),
      },
    });

    this.logger.log(`Ensured single admin account exists: ${adminEmail}`);
  }
}
