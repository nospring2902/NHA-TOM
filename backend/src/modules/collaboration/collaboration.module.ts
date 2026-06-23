import { Module } from '@nestjs/common';
import { CollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';
import { PondAccessService } from './pond-access.service';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [FriendsModule],
  controllers: [CollaborationController],
  providers: [CollaborationService, PondAccessService],
  exports: [PondAccessService, CollaborationService],
})
export class CollaborationModule {}
