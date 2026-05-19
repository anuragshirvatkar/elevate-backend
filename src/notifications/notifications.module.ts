import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationHandler } from './handlers/notification.handler';
import { NotificationsScheduler } from './notifications.scheduler';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationHandler, NotificationsScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
