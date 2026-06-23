import { Module } from '@nestjs/common';
import { PondsController } from './ponds.controller';
import { PondsService } from './ponds.service';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [CollaborationModule],
  controllers: [PondsController],
  providers: [PondsService],
  exports: [PondsService],
})
export class PondsModule {}
