import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, IsUUID, Matches } from 'class-validator';

export class SetupActivityDto {
  @ApiPropertyOptional({ example: 'uuid' })
  @IsString()
  @IsUUID('4')
  activityId: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class EditSetupDto {
  @ApiPropertyOptional({ example: '19:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, { message: 'Time must be in HH:MM or HH:MM:SS format' })
  preferredTime?: string;

  @ApiPropertyOptional({ example: ['Sunday'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restDays?: string[];

  @ApiPropertyOptional({ type: [SetupActivityDto] })
  @IsArray()
  @IsOptional()
  activities?: SetupActivityDto[];
}
