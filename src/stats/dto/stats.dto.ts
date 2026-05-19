import { ApiPropertyOptional } from '@nestjs/swagger';

export class StatsQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', '1y', 'all', 'custom'], example: '30d' })
  period?: '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

  @ApiPropertyOptional({ example: '2026-04-18' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-05-18' })
  endDate?: string;
}
