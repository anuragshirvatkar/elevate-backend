import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressBookDto } from './progress-book.dto';

export class MindSectionDto {
  @ApiPropertyOptional({ example: '21:00:00', description: 'Preferred time in HH:MM:SS format' })
  preferredTime: string | null;

  @ApiProperty({ example: [], description: 'Rest days for mind/reading section' })
  restDays: string[];

  @ApiProperty({ type: [ProgressBookDto] })
  books: ProgressBookDto[];
}
