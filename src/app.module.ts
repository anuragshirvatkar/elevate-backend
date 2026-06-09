import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { AppTrackingModule } from './app-tracking/app-tracking.module';
import { SetupModule } from './setup/setup.module';
import { ActivitiesModule } from './activities/activities.module';
import { BooksModule } from './books/books.module';
import { CompanionMessagesModule } from './companion-messages/companion-messages.module';
import { AchievementsModule } from './achievements/achievements.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { EventsModule } from './events/events.module';
import { UploadsModule } from './uploads/uploads.module';
import { AuthModule } from './auth/auth.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JournalsModule } from './journals/journals.module';
import { CompanionModule } from './companion/companion.module';
import { InsightsModule } from './insights/insights.module';
import { ProfileModule } from './profile/profile.module';
import { HelpModule } from './help/help.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { StatsModule } from './stats/stats.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MailModule,
    AppTrackingModule,
    SetupModule,
    ActivitiesModule,
    BooksModule,
    CompanionMessagesModule,
    AchievementsModule,
    EventsModule,
    UploadsModule,
    CloudinaryModule,
    AuthModule,
    LeaderboardModule,
    NotificationsModule,
    JournalsModule,
    CompanionModule,
    InsightsModule,
    ProfileModule,
    HelpModule,
    ActivityLogsModule,
    StatsModule,
    SupportModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
