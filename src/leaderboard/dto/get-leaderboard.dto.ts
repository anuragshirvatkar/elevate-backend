import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsIn, Min, Max } from 'class-validator';
import { LEADERBOARD_PERIODS, LEADERBOARD_SECTIONS } from '../constants/leaderboard.constants';

export class GetLeaderboardDto {
  @ApiPropertyOptional({
    enum: LEADERBOARD_PERIODS,
    default: 'weekly',
    description: 'Time period to aggregate points over',
  })
  @IsOptional()
  @IsString()
  @IsIn(LEADERBOARD_PERIODS)
  period?: string;

  @ApiPropertyOptional({
    enum: LEADERBOARD_SECTIONS,
    default: 'all',
    description: 'Section to filter by. Use "all" for total points across all sections.',
  })
  @IsOptional()
  @IsString()
  @IsIn(LEADERBOARD_SECTIONS)
  section?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Ignored by backend; allowed for client caching' })
  @IsOptional()
  today?: string;
}
