import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUsersQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: '2024-01-15',
    description: 'Filter users who logged in on this date (YYYY-MM-DD)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;

  @ApiPropertyOptional({
    example: '2024-01-15',
    description: 'Filter users who opened the app on this date (YYYY-MM-DD)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'openedDate must be in YYYY-MM-DD format' })
  openedDate?: string;
}
