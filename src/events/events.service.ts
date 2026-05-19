import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityLoggedEvent } from './activity-logged.event';
import { EventNames } from './event-names';

@Injectable()
export class EventsService {
  constructor(private eventEmitter: EventEmitter2) {}

  emitActivityLogged(payload: ActivityLoggedEvent): void {
    this.eventEmitter.emit(EventNames.ACTIVITY_LOGGED, payload);
  }
}
