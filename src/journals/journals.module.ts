import { Module } from '@nestjs/common';
import { JournalsService } from './journals.service';
import { JournalsController } from './journals.controller';

@Module({
  controllers: [JournalsController],
  providers: [JournalsService],
})
export class JournalsModule {}
