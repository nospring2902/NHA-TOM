import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  controllers: [FriendsController],
  providers: [FriendsService, PresenceService, RealtimeService, RealtimeGateway],
  exports: [RealtimeService, PresenceService],
})
export class FriendsModule {}
