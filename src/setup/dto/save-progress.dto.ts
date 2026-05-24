import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SaveSectionsDto } from './save-sections.dto';

export class SaveProgressDto {
  @ApiPropertyOptional({ example: '2001-01-01', description: 'Date of birth (YYYY-MM-DD). Only updated if provided.' })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiPropertyOptional({ example: '3e1a2b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', description: 'ID of the companion to select. Only updated if provided.' })
  @IsOptional()
  @IsUUID()
  companionId?: string;

  @ApiPropertyOptional({ type: SaveSectionsDto, description: 'Partial or full section data. Only provided sections are updated.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveSectionsDto)
  sections?: SaveSectionsDto;
}
