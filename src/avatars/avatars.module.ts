import { Module } from '@nestjs/common';
import { AvatarsService } from './avatars.service';

@Module({
  providers: [AvatarsService],
  exports: [AvatarsService],
})
export class AvatarsModule {}
