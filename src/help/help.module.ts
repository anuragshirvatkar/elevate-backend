import { Module } from '@nestjs/common';
import { HelpService } from './help.service';
import { HelpController } from './help.controller';

@Module({
  controllers: [HelpController],
  providers: [HelpService],
})
export class HelpModule {}
