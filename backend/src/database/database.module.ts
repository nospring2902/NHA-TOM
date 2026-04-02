import { Module } from '@nestjs/common';
import { DatabaseHealthController } from './database-health.controller';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DatabaseHealthController],
})
export class DatabaseModule {}
