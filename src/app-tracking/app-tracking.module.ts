import { Global, Module } from '@nestjs/common';
import { AppTrackingService } from './app-tracking.service';
import { AppTrackingController } from './app-tracking.controller';

@Global()
@Module({
  providers: [AppTrackingService],
  exports: [AppTrackingService],
  controllers: [AppTrackingController],
})
export class AppTrackingModule {}
