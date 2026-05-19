import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityLoggedEvent } from '../activity-logged.event';
import { EventNames } from '../event-names';

@Injectable()
export class ActivityLoggedHandler {
  private readonly logger = new Logger(ActivityLoggedHandler.name);

  @OnEvent(EventNames.ACTIVITY_LOGGED)
  handle(event: ActivityLoggedEvent): void {
    this.logger.log(
      `Activity logged event received: userId=${event.userId} section=${event.section} activityLogId=${event.activityLogId}`,
    );
  }
}
