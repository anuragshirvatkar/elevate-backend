import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsISO8601, Min, Max } from 'class-validator';

export class UpsertJournalDto {
  @ApiProperty({
    example: '2026-05-18',
    description: 'Date of the journal entry in YYYY-MM-DD format',
  })
  @IsString()
  @IsISO8601({ strict: false })
  date: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'Mood rating from 1 (very low) to 5 (great)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  mood?: number;

  @ApiPropertyOptional({
    example: 'Completed workout',
    description: 'Win of the day',
  })
  @IsOptional()
  @IsString()
  win_of_the_day?: string;

  @ApiPropertyOptional({
    example: 'I focus better after gym',
    description: 'Lesson learned today',
  })
  @IsOptional()
  @IsString()
  lesson_learned?: string;

  @ApiPropertyOptional({
    example: 'Read for 30 minutes',
    description: "Tomorrow's mission",
  })
  @IsOptional()
  @IsString()
  tomorrow_mission?: string;
}
