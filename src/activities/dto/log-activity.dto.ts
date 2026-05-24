import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsUUID, IsISO8601 } from 'class-validator';

export class LogActivityDto {
  @ApiProperty({ example: 'power', enum: ['power', 'craft', 'mind', 'purity'] })
  @IsString()
  section: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    description: 'Required for power and craft sections. Must be null for mind and purity.',
  })
  @IsOptional()
  @IsUUID('4')
  activityId?: string;

  @ApiPropertyOptional({
    example: null,
    description: 'Required for mind section. Must be null for power, craft, and purity.',
  })
  @IsOptional()
  @IsUUID('4')
  userBookId?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the user completed the activity. Defaults to false on first create if omitted.' })
  @IsOptional()
  @IsBoolean()
  didUserDo?: boolean;

  @ApiPropertyOptional({
    example: 1.5,
    description: 'Duration in hours (decimal). Must be null when didUserDo is false. Not used for purity.',
  })
  @IsOptional()
  @IsNumber()
  hours?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Number of relapses today. Required for purity section. 0 = clean day.',
  })
  @IsOptional()
  @IsNumber()
  relapseCount?: number;

  @ApiPropertyOptional({
    example: 'Leg day felt easier today',
    description: 'Free-text description or reflection for the session.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: null,
    description: 'Optional reason for skipping. Only relevant when didUserDo is false.',
  })
  @IsOptional()
  @IsString()
  reasonIfNo?: string;

  @ApiProperty({ example: '2026-05-17', description: 'Date of the activity in YYYY-MM-DD format' })
  @IsString()
  @IsISO8601({ strict: false })
  date: string;

  @ApiPropertyOptional({
    type: [String],
    example: [
      'https://res.cloudinary.com/demo/image/upload/elevate/activity-images/img1.jpg',
    ],
    description:
      'Optional image URLs from POST /uploads/activity-image. Max 5. Must be empty when didUserDo is false.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
