import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanionMessageResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' })
  id: string;

  @ApiProperty({
    example: 'ACHIEVEMENT',
    enum: ['ACHIEVEMENT', 'AVATAR_UNLOCKED', 'AVATAR_REVOKED', 'LEADERBOARD_ENTERED', 'LEADERBOARD_MOVED', 'LEADERBOARD_NEAR', 'MILESTONE', 'RECOVERY'],
  })
  type: string;

  @ApiProperty({ example: 'Riven' })
  companionName: string;

  @ApiProperty({ example: 'Iron Discipline' })
  title: string;

  @ApiProperty({ example: 'Twenty days. Discipline is no longer something you do. It is becoming who you are.' })
  message: string;

  @ApiPropertyOptional({ example: 'achievement', description: 'Entity type for deep linking' })
  entityType: string | null;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', description: 'Entity ID for deep linking' })
  entityId: string | null;

  @ApiPropertyOptional({ example: 'open_achievement', description: 'Deep link action' })
  action: string | null;

  @ApiPropertyOptional({ example: { imageUrl: 'https://...' }, description: 'Optional context metadata' })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2026-05-18T08:00:00.000Z' })
  createdAt: string;
}
