import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFlOW...', description: 'Google ID token received from Google Sign-In' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
