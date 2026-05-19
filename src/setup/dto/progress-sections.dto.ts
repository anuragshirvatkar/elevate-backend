import { ApiProperty } from '@nestjs/swagger';
import { ActivitySectionDto } from './activity-section.dto';
import { MindSectionDto } from './mind-section.dto';

export class ProgressSectionsDto {
  @ApiProperty({ type: ActivitySectionDto })
  power: ActivitySectionDto;

  @ApiProperty({ type: ActivitySectionDto })
  craft: ActivitySectionDto;

  @ApiProperty({ type: MindSectionDto })
  mind: MindSectionDto;
}
