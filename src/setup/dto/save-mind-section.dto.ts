import { ApiPropertyOptional } from '@nestjs/swagger';

export class SaveMindSectionDto {
  @ApiPropertyOptional({ example: false, description: 'If true, Mind section is skipped (is_active=false). No books required.' })
  skipMind?: boolean;

  @ApiPropertyOptional({ example: '21:00:00', description: 'Preferred time in HH:MM:SS format' })
  preferredTime?: string;

  @ApiPropertyOptional({ example: [], description: 'Rest days for reading section' })
  restDays?: string[];

  @ApiPropertyOptional({
    example: ['1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d'],
    description: 'books_catalog IDs (global or user custom). Replaces all current selections.',
  })
  bookIds?: string[];
}
