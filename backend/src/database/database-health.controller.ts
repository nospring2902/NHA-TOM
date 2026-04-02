import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator';
import { PrismaService } from './prisma.service';

@Controller('database')
export class DatabaseHealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        success: true,
        message: 'Database connection is healthy',
        data: {
          status: 'up',
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        message: 'Database connection failed',
        data: {
          status: 'down',
        },
      });
    }
  }
}
