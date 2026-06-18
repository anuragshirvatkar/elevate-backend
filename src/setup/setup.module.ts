import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { AchievementsModule } from '../achievements/achievements.module';
import { CompanionMessagesModule } from '../companion-messages/companion-messages.module';
import { AvatarsModule } from '../avatars/avatars.module';

@Module({
  imports: [AchievementsModule, CompanionMessagesModule, AvatarsModule],
  providers: [SetupService],
  controllers: [SetupController],
})
export class SetupModule {}
