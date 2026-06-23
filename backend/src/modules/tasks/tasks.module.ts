import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [CollaborationModule, NotificationsModule, FriendsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
