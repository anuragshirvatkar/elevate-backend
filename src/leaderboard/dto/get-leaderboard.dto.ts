import { ApiPropertyOptional } from '@nestjs/swagger';
import { LEADERBOARD_PERIODS, LEADERBOARD_SECTIONS } from '../constants/leaderboard.constants';

export class GetLeaderboardDto {
  @ApiPropertyOptional({
    enum: LEADERBOARD_PERIODS,
    default: 'weekly',
    description: 'Time period to aggregate points over',
  })
  period?: string;

  @ApiPropertyOptional({
    enum: LEADERBOARD_SECTIONS,
    default: 'all',
    description: 'Section to filter by. Use "all" for total points across all sections.',
  })
  section?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  limit?: number;
}
