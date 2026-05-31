import { Module } from '@nestjs/common';
import { JournalsService } from './journals.service';
import { JournalsController } from './journals.controller';
import { JournalPointsHandler } from '../events/handlers/journal-points.handler';

@Module({
  controllers: [JournalsController],
  providers: [JournalsService, JournalPointsHandler],
})
export class JournalsModule {}
