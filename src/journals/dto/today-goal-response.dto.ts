import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TodayGoalResponseDto {
  @ApiProperty({ example: true, description: 'Whether the homescreen goal popup should be shown' })
  show: boolean;

  @ApiPropertyOptional({ example: "Today's goal" })
  heading?: string;

  @ApiPropertyOptional({
    example: 'Finish chapter 3 of Atomic Habits\nGo for a morning run\nNo social media before noon',
    description: 'Goal text truncated to 3 lines when longer',
  })
  goal?: string;

  @ApiPropertyOptional({ example: '2026-06-14', description: 'Journal date the goal was taken from (yesterday)' })
  sourceDate?: string;
}
