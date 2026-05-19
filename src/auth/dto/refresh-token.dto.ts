import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'a3f8c2d1e9b74f0a6c3e5d2b1a8f7e4c9d6b3a1f8e5c2...', description: 'Long-lived refresh token received at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
