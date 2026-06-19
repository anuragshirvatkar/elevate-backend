import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityLoggedEvent } from './activity-logged.event';
import { EventNames } from './event-names';

@Injectable()
export class EventsService {
  constructor(private eventEmitter: EventEmitter2) {}

  async emitActivityLogged(payload: ActivityLoggedEvent): Promise<void> {
    await this.eventEmitter.emitAsync(EventNames.ACTIVITY_LOGGED, payload);
  }
}
