import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressActivityDto } from './progress-activity.dto';

export class ActivitySectionDto {
  @ApiPropertyOptional({ example: '07:00:00', description: 'Preferred time in HH:MM:SS format' })
  preferredTime: string | null;

  @ApiProperty({ example: ['sunday'], description: 'Rest days for this section' })
  restDays: string[];

  @ApiProperty({ type: [ProgressActivityDto] })
  activities: ProgressActivityDto[];
}
