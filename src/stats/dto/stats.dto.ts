import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsISO8601 } from 'class-validator';

export class StatsQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', '1y', 'all', 'custom'], example: '30d' })
  @IsOptional()
  @IsString()
  @IsIn(['7d', '30d', '90d', '1y', 'all', 'custom'])
  period?: '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

  @ApiPropertyOptional({ example: '2026-04-18' })
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: false })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-05-18' })
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: false })
  endDate?: string;

  @ApiPropertyOptional({ example: '2026-06-03', description: "Client's local today date (YYYY-MM-DD). Always pass this to get accurate stats regardless of timezone." })
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: false })
  today?: string;
}
