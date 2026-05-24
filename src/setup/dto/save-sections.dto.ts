import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SaveActivitySectionDto } from './save-activity-section.dto';
import { SaveMindSectionDto } from './save-mind-section.dto';

export class SaveSectionsDto {
  @ApiPropertyOptional({ type: SaveActivitySectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveActivitySectionDto)
  power?: SaveActivitySectionDto;

  @ApiPropertyOptional({ type: SaveActivitySectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveActivitySectionDto)
  craft?: SaveActivitySectionDto;

  @ApiPropertyOptional({ type: SaveMindSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveMindSectionDto)
  mind?: SaveMindSectionDto;
}
