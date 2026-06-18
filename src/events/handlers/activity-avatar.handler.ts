import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AvatarsService } from '../../avatars/avatars.service';
import { ActivityLoggedEvent } from '../activity-logged.event';
import { EventNames } from '../event-names';

@Injectable()
export class ActivityAvatarHandler {
  private readonly logger = new Logger(ActivityAvatarHandler.name);

  constructor(private avatarsService: AvatarsService) {}

  @OnEvent(EventNames.ACTIVITY_LOGGED)
  async handle(event: ActivityLoggedEvent): Promise<void> {
    const today = new Date(event.date);
    today.setUTCHours(0, 0, 0, 0);
    await this.avatarsService.syncAllAvatarUnlocks(event.userId, today);
  }
}
