import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityLogEntryDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' })
  id: string;

  @ApiProperty({ example: 'power', enum: ['power', 'craft', 'mind', 'purity'] })
  section: string;

  @ApiPropertyOptional({ example: 'uuid-of-activity' })
  activityId?: string;

  @ApiPropertyOptional({ example: 'Gym' })
  activityName?: string;

  @ApiPropertyOptional({ example: 'uuid-of-user-book' })
  userBookId?: string;

  @ApiPropertyOptional({ example: 'Atomic Habits' })
  bookTitle?: string;

  @ApiPropertyOptional({ example: true })
  didUserDo?: boolean;

  @ApiPropertyOptional({ example: 1.5 })
  hours?: number;

  @ApiPropertyOptional({ example: 0 })
  relapseCount?: number;

  @ApiPropertyOptional({ example: 'Leg day felt easier today' })
  description?: string;

  @ApiPropertyOptional({ example: null })
  reasonIfNo?: string;

  @ApiProperty({
    type: [String],
    example: ['https://res.cloudinary.com/demo/image/upload/elevate/activity-images/img1.jpg'],
  })
  images: string[];

  @ApiProperty({ example: '2026-05-17' })
  date: string;

  @ApiProperty({
    example: 12,
    description: 'Net points for this log. Positive = gained, negative = lost, 0 = none.',
  })
  points: number;
}
