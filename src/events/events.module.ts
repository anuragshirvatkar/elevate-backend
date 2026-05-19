import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { ActivityLoggedHandler } from './handlers/activity-logged.handler';
import { ActivityPointsHandler } from './handlers/activity-points.handler';
import { ActivityStreakHandler } from './handlers/activity-streak.handler';
import { ActivityAchievementHandler } from './handlers/activity-achievement.handler';
import { ActivityAvatarHandler } from './handlers/activity-avatar.handler';
import { AchievementsModule } from '../achievements/achievements.module';
import { AvatarsModule } from '../avatars/avatars.module';

@Module({
  imports: [AchievementsModule, AvatarsModule],
  providers: [
    EventsService,
    ActivityLoggedHandler,
    ActivityPointsHandler,
    ActivityStreakHandler,
    ActivityAchievementHandler,
    ActivityAvatarHandler,
  ],
  exports: [EventsService],
})
export class EventsModule {}
