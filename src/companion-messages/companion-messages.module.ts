import { Module } from '@nestjs/common';
import { CompanionMessagesService } from './companion-messages.service';
import { CompanionMessagesController } from './companion-messages.controller';

@Module({
  providers: [CompanionMessagesService],
  controllers: [CompanionMessagesController],
  exports: [CompanionMessagesService],
})
export class CompanionMessagesModule {}
