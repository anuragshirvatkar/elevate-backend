import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { EventsModule } from '../events/events.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { CompanionMessagesModule } from '../companion-messages/companion-messages.module';

@Module({
  imports: [EventsModule, AchievementsModule, CompanionMessagesModule],
  providers: [ActivitiesService],
  controllers: [ActivitiesController],
})
export class ActivitiesModule {}
