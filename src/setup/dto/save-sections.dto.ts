import { ApiPropertyOptional } from '@nestjs/swagger';
import { SaveActivitySectionDto } from './save-activity-section.dto';
import { SaveMindSectionDto } from './save-mind-section.dto';

export class SaveSectionsDto {
  @ApiPropertyOptional({ type: SaveActivitySectionDto })
  power?: SaveActivitySectionDto;

  @ApiPropertyOptional({ type: SaveActivitySectionDto })
  craft?: SaveActivitySectionDto;

  @ApiPropertyOptional({ type: SaveMindSectionDto })
  mind?: SaveMindSectionDto;
}
