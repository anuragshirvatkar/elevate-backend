import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsScheduler } from './insights.scheduler';
import { InsightHandler } from './handlers/insight.handler';
import { CompanionMessagesModule } from '../companion-messages/companion-messages.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CompanionMessagesModule, NotificationsModule],
  providers: [InsightsService, InsightsScheduler, InsightHandler],
})
export class InsightsModule {}
