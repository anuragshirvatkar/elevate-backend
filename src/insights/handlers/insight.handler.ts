import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanionMessagesService } from '../../companion-messages/companion-messages.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CompanionMessageType } from '../../companion-messages/companion-message-types';
import { NotificationTypes } from '../../notifications/constants/notification-types';
import { InsightAIResponse } from '../types/insight.types';

@Injectable()
export class InsightHandler {
  private readonly logger = new Logger(InsightHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companionMessagesService: CompanionMessagesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(userId: string, aiResponse: InsightAIResponse): Promise<void> {
    const now = new Date();

    await this.prisma.user_insights.create({
      data: {
        user_id: userId,
        type: aiResponse.category,
        insight_text: aiResponse.companionMessage,
        reference_date: now,
        created_at: now,
      },
    });

    await this.companionMessagesService.createMessage({
      userId,
      type: CompanionMessageType.INSIGHT,
      companionName: 'Riven',
      title: aiResponse.companionIntro,
      message: aiResponse.companionMessage,
      entityType: 'insight',
      action: aiResponse.category,
    });

    await this.notificationsService.sendNotification(
      userId,
      NotificationTypes.INSIGHT,
      aiResponse.notificationTitle,
      'Open Companion to view your insight.',
      { action: 'open_companion' },
    );

    this.logger.log(`Insight handled: userId=${userId} category=${aiResponse.category}`);
  }
}
