import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JournalCreatedEvent } from '../journal-created.event';
import { EventNames } from '../event-names';

@Injectable()
export class JournalPointsHandler {
  private readonly logger = new Logger(JournalPointsHandler.name);

  @OnEvent(EventNames.JOURNAL_CREATED)
  handle(event: JournalCreatedEvent): void {
    this.logger.log(`Journal created event received: userId=${event.userId} journalId=${event.journalId}`);
  }
}
