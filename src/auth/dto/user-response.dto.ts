import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '9f1e3b2a-4c5d-4e6f-8a7b-1c2d3e4f5a6b' })
  id: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  email: string | null;

  @ApiPropertyOptional({ example: '108234567890123456789', description: 'Populated only for Google-linked accounts' })
  google_id: string | null;

  @ApiProperty({ example: 'anurag_1715443200000' })
  username: string;

  @ApiPropertyOptional({ example: '2000-01-15', description: 'Date of birth' })
  date_of_birth: Date | null;

  @ApiProperty({ example: false })
  onboarding_completed: boolean;

  @ApiPropertyOptional({ example: '2026-06-01T14:17:00.000Z', description: 'Timestamp of current login' })
  last_login_at: Date | null;

  @ApiPropertyOptional({ example: '2026-05-07T09:30:00.000Z', description: 'Timestamp of previous login (used for last-seen UX)' })
  last_seen_at: Date | null;

  @ApiPropertyOptional({ example: '2026-04-01T10:00:00.000Z' })
  created_at: Date | null;

  @ApiPropertyOptional({ example: '2026-06-01T14:17:00.000Z' })
  updated_at: Date | null;
}
