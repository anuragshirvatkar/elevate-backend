import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AppOpenDto {
  @ApiPropertyOptional({
    example: 'America/New_York',
    description: 'IANA timezone identifier from the device (e.g. Asia/Kolkata, America/New_York).',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
