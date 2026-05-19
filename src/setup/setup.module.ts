import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { AchievementsModule } from '../achievements/achievements.module';
import { CompanionMessagesModule } from '../companion-messages/companion-messages.module';

@Module({
  imports: [AchievementsModule, CompanionMessagesModule],
  providers: [SetupService],
  controllers: [SetupController],
})
export class SetupModule {}
