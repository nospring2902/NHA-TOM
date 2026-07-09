import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertNotifierService } from './alert-notifier.service';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CollaborationModule, NotificationsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertNotifierService],
  exports: [AlertNotifierService],
})
export class AlertsModule {}
