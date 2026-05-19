import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZjFl...', description: 'Short-lived JWT access token (1h)' })
  accessToken: string;

  @ApiProperty({ example: 'a3f8c2d1e9b74f0a6c3e5d2b1a8f7e4c...', description: 'Long-lived opaque refresh token (90 days)' })
  refreshToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ example: false, description: 'True if this is the first time this user has authenticated' })
  isNewUser: boolean;

  @ApiPropertyOptional({ example: 4, description: 'Days since last app open. Null if user has never opened the app before.' })
  daysSinceLastLogin: number | null;
}
