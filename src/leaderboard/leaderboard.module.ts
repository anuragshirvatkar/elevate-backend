import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardMonitorHandler } from './handlers/leaderboard-monitor.handler';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService, LeaderboardMonitorHandler],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
