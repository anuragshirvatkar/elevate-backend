import { ApiPropertyOptional } from '@nestjs/swagger';

export class SaveActivitySectionDto {
  @ApiPropertyOptional({ example: '07:00:00', description: 'Preferred time in HH:MM:SS format' })
  preferredTime?: string;

  @ApiPropertyOptional({ example: ['sunday'], description: 'Rest days for this section' })
  restDays?: string[];

  @ApiPropertyOptional({
    example: ['7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d'],
    description: 'Activity IDs (global or user custom). Replaces all current selections.',
  })
  activityIds?: string[];
}
