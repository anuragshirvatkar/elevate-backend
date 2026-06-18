import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminTicketsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'open', enum: ['open', 'in_progress', 'resolved', 'closed'] })
  @IsOptional()
  @IsIn(['open', 'in_progress', 'resolved', 'closed'])
  status?: string;

  @ApiPropertyOptional({ example: 'bug', enum: ['bug', 'feature_request', 'payment', 'account', 'other'] })
  @IsOptional()
  @IsIn(['bug', 'feature_request', 'feedback', 'payment', 'account', 'other'])
  issueType?: string;
}
