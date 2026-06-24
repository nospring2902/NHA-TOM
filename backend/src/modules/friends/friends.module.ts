import { forwardRef, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [FriendsController],
  providers: [FriendsService, PresenceService, RealtimeService, RealtimeGateway],
  exports: [RealtimeService, PresenceService],
})
export class FriendsModule {}
