import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, IsUUID, Matches } from 'class-validator';

export class MindSetupBookDto {
  @ApiPropertyOptional({ example: 'uuid' })
  @IsString()
  @IsUUID('4')
  userBookId: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

export class EditMindSetupDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '21:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, { message: 'Time must be in HH:MM or HH:MM:SS format' })
  preferredTime?: string;

  @ApiPropertyOptional({ example: ['Sunday'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restDays?: string[];

  @ApiPropertyOptional({ type: [MindSetupBookDto] })
  @IsArray()
  @IsOptional()
  books?: MindSetupBookDto[];
}

export class EditSummaryDto {
  @ApiPropertyOptional({ example: 'Updated custom summary' })
  @IsString()
  summary: string;
}
