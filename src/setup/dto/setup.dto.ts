import { ApiPropertyOptional } from '@nestjs/swagger';

export class SetupActivityDto {
  @ApiPropertyOptional({ example: 'uuid' })
  activityId: string;

  @ApiPropertyOptional({ example: true })
  isPrimary: boolean;
}

export class EditSetupDto {
  @ApiPropertyOptional({ example: '19:00' })
  preferredTime?: string;

  @ApiPropertyOptional({ example: ['Sunday'] })
  restDays?: string[];

  @ApiPropertyOptional({ type: [SetupActivityDto] })
  activities: SetupActivityDto[];
}
