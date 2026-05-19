import { Module } from '@nestjs/common';
import { CompanionService } from './companion.service';
import { CompanionController } from './companion.controller';
import { CompanionHandler } from './handlers/companion.handler';
import { CompanionMessagesModule } from '../companion-messages/companion-messages.module';

@Module({
  imports: [CompanionMessagesModule],
  controllers: [CompanionController],
  providers: [CompanionService, CompanionHandler],
})
export class CompanionModule {}
